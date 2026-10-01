<?php

namespace App\Services\Ai;

/**
 * Static knowledge the help assistant uses to explain LibraLearn.
 * Keep page names and paths in sync with frontend/src/App.jsx.
 */
class AssistantKnowledge
{
    public static function rules(): array
    {
        $fine = config('library.fine_per_day');

        return [
            'Loan period: ' . config('library.loan_days') . ' days.',
            'Maximum active loans per student: ' . config('library.max_active_loans') . ' books.',
            'Renewals: ' . config('library.max_renewals') . ' per loan, ' . config('library.renewal_days') . ' extra day each. The librarian approves renewals.',
            $fine !== null && $fine !== ''
                ? 'Overdue fine: PHP ' . $fine . ' per day.'
                : 'Overdue fines apply. The amount is set by the librarian; tell the student to ask the librarian.',
            'A book counts as borrowed only after the librarian approves and hands over the physical copy.',
            'A return is complete only after the librarian checks the physical book and confirms it.',
            'New student accounts stay pending until the librarian approves them.',
        ];
    }

    public static function studentGuide(): array
    {
        return [
            'Dashboard (/dashboard): recommended books, current loans, due dates, reservation status, notifications.',
            'Search the GSA library: use the search bar on the Dashboard or the Search page (/search). Search by title, author, ISBN, genre, subject, or keyword. Partial words work, for example "harry".',
            'Book details (/books/{id}): cover, description, availability, section and shelf, plus Borrow, Reserve, and Save buttons.',
            'Borrow: open an available book, press "Request to Borrow". The librarian reviews the request, you get a notification, then you pick up the book at the library.',
            'Reserve: when every copy is out, press "Reserve Book" on the book page. You get a notification when the book is ready for pickup.',
            'Return: open My Books (/my-books), press "Request Return" on the loan, then bring the physical book to the librarian. The return finishes when the librarian confirms.',
            'My Books (/my-books): current loans, due dates, return requests, borrowing history.',
            'Saved Books (/saved-books): books you bookmarked with the "Save Book" button.',
            'Recommendations (/recommendations): books matched to your interests. Press Like or Not Interested to improve future picks. Change interests on your Profile.',
            'Online Search (/online-search): search Open Library and Google Books when GSA does not have a book. Online results are not physical GSA books.',
            'Library Map (/library-map): sections such as Fiction, Science, Mathematics, English, Filipino, History, Reference. Click a section to see its shelves.',
            'Notifications (/notifications): approvals, pickup notices, due-date reminders, overdue notices.',
            'Profile (/profile): name, grade, section, photo, reading interests.',
        ];
    }

    public static function librarianGuide(): array
    {
        return [
            'Dashboard (/librarian/dashboard): totals, pending requests, pending returns, recent books.',
            'Books (/librarian/books): add, edit, deactivate books; set genre, subject, section, shelf, status; filter by genre, subject, status, section, author, year.',
            'AI Cataloging (/librarian/ai-catalog): upload a cover photo, the system reads the text, checks Open Library then Google Books, suggests genre and subject. Review every field, then press "Confirm & Add to Catalog". Nothing enters the catalog without your confirmation.',
            'Borrowing (/librarian/borrowing): approve or reject requests, confirm hand-over, extend due dates, mark overdue, lost, or damaged.',
            'Reservations (/librarian/reservations): approve, mark ready for pickup, complete, or expire reservations.',
            'Returns (/librarian/returns): confirm physical returns after checking the book condition.',
            'Students (/librarian/students): approve new accounts, edit, activate or deactivate, view each student\'s loans and interests.',
            'AI Insights (/librarian/insights): most used books by month, demand trend by genre and subject, forecast for the current month, and which titles need more copies with the reasons.',
            'Reports (/librarian/reports): book, borrowing, student activity, and AI cataloging reports with date filters.',
            'Settings (/librarian/settings): library settings and theme.',
        ];
    }
}
