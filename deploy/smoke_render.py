"""Verify a deployed synthetic demo without printing credentials or API bodies."""
import argparse
import getpass
import json
import os
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--external', action='store_true', help='Also probe search and assistant providers')
    args = parser.parse_args()
    base = args.url.rstrip('/')
    parts = urlsplit(base)
    if (parts.scheme != 'https' and not (parts.scheme == 'http' and parts.hostname in {'localhost', '127.0.0.1'})) or parts.username or parts.password or parts.query or parts.fragment or parts.path not in {'', '/'}:
        parser.error('Use an HTTPS service origin (HTTP is allowed only for localhost).')
    password = os.environ.get('LIBRARY_DEMO_PASSWORD') or getpass.getpass('Hosted demo password: ')
    opener = build_opener(NoRedirect())
    failures = []
    tokens = []

    def request(path, token=None, payload=None, expected=200, decode=True):
        headers = {'Accept': 'application/json', 'User-Agent': 'LibraLearn-deployment-check/1.0'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        data = None
        if payload is not None:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(payload).encode()
        req = Request(urljoin(base + '/', path), data=data, headers=headers)
        try:
            with opener.open(req, timeout=90) as response:
                status, body = response.status, response.read()
        except HTTPError as error:
            status, body = error.code, b''
        except (URLError, TimeoutError, OSError):
            raise RuntimeError('connection failed') from None
        if status != expected:
            raise RuntimeError('HTTP %s (expected %s)' % (status, expected))
        if decode:
            try:
                return json.loads(body)
            except (ValueError, UnicodeError):
                raise RuntimeError('response was not JSON') from None
        return body

    def check(label, probe):
        try:
            result = probe()
            print('PASS ' + label, flush=True)
            return result
        except Exception as error:
            # Only display our own fixed diagnostic strings, never provider bodies.
            reason = str(error) if type(error) is RuntimeError else type(error).__name__
            print('FAIL %s (%s)' % (label, reason), flush=True)
            failures.append(label)
            return None

    def require(value, message):
        if not value:
            raise RuntimeError(message)
        return value

    def login(email, path):
        result = request(path, payload={'login': email, 'password': password})
        token = require(result.get('token'), 'missing authentication token')
        tokens.append(token)
        return token

    def frontend():
        html = request('/', decode=False).decode('utf-8')
        assets = re.findall(r'(?:src|href)=["\']([^"\']*/build/assets/[^"\']+)["\']', html)
        require(assets, 'missing production assets')
        for asset in assets:
            require(request(asset, decode=False), 'empty production asset')

    check('Frontend and production assets', frontend)
    for path in ['/up', '/api/landing/stats', '/api/landing/featured-book', '/api/auth/registration-interests']:
        check(path, lambda path=path: request(path, decode=path != '/up'))
    check('Guest access denied', lambda: request('/api/books', expected=401, decode=False))
    admin = check('Staff login', lambda: login('admin@demo.example', '/api/auth/librarian/login'))
    student = check('Student login', lambda: login('student01@demo.example', '/api/auth/login'))
    try:
        if admin:
            for path in [
                '/api/auth/me', '/api/books', '/api/books/genres', '/api/books/subjects', '/api/books/available',
                '/api/borrow', '/api/reservations', '/api/ai-catalog', '/api/users', '/api/library-settings',
                '/api/dashboard/librarian', '/api/notifications', '/api/notifications/unread-count',
                '/api/library-locations', '/api/library-locations/map', '/api/interests',
                '/api/reports/books', '/api/reports/borrowing', '/api/reports/student-activity', '/api/reports/ai-cataloging',
            ]:
                check('Staff ' + path, lambda path=path: request(path, admin))
            for report in ['books', 'borrowing', 'student-activity', 'ai-cataloging']:
                path = '/api/reports/%s/export' % report
                check(path, lambda path=path: require(request(path, admin, decode=False), 'empty report'))

            def seeded_cover():
                books = request('/api/books?search=The%20Lantern%20of%20Isla%20Verde', admin)['data']['data']
                book = next((book for book in books if book.get('isbn') == 'SYN-BOOK-001'), None)
                require(book, 'synthetic title missing')
                request('/api/books/%s/copies' % book['id'], admin)
                cover = require(book.get('cover_url'), 'synthetic cover missing')
                # Public bucket request deliberately carries no authentication token.
                require(request(cover, decode=False), 'cover download empty')
            check('Synthetic catalog, copies and public cover', seeded_cover)

            def forecast():
                data = request('/api/ai/insights?months=6', admin)['data']
                deadline = time.monotonic() + 180
                while data.get('processing') and time.monotonic() < deadline:
                    time.sleep(4)
                    data = request('/api/ai/insights?months=6', admin)['data']
                require(not data.get('processing'), 'queue processing did not finish')
                require(data.get('predictions', {}).get('engine') in {'prophet', 'statsmodels'}, 'Python forecast missing')
            check('Queued Python forecasting', forecast)

        if student:
            for path in [
                '/api/auth/me', '/api/dashboard/student', '/api/books', '/api/borrow', '/api/reservations',
                '/api/saved-books', '/api/recommendations', '/api/recommendations/interests',
                '/api/notifications', '/api/online-search/history', '/api/library-locations/map',
            ]:
                check('Student ' + path, lambda path=path: request(path, student))
            for path in ['/api/users', '/api/ai/insights']:
                check('Student permission ' + path, lambda path=path: request(path, student, expected=403, decode=False))
            if args.external:
                for source in ['open_library', 'google_books']:
                    check('Live ' + source, lambda source=source: require(request('/api/online-search', student,
                          {'query': 'Harry Potter', 'source': source}).get('data'), 'provider returned no books'))
                check('Live assistant', lambda: require(request('/api/assistant/chat', student,
                      {'messages': [{'role': 'user', 'content': 'How do I borrow a library book?'}]}).get('reply'), 'assistant reply empty'))
    finally:
        for index, token in enumerate(tokens, 1):
            check('Revoke smoke token %s' % index, lambda token=token: request('/api/auth/logout', token, {}))
    print('%s failed checks' % len(failures), flush=True)
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
