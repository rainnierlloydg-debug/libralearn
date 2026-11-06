FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM php:8.3-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev libonig-dev libicu-dev libzip-dev libxml2-dev libcurl4-openssl-dev unzip \
    python3 python3-venv libgomp1 supervisor \
    && docker-php-ext-install pdo_pgsql pdo_mysql mbstring intl zip bcmath opcache dom simplexml curl pcntl \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY forecasting/requirements.txt /tmp/forecast-requirements.txt
RUN python3 -m venv /opt/forecast-venv \
    && /opt/forecast-venv/bin/pip install --no-cache-dir -r /tmp/forecast-requirements.txt
WORKDIR /var/www/html
COPY composer.json composer.lock artisan ./
COPY app/ app/
COPY bootstrap/ bootstrap/
COPY config/ config/
COPY database/ database/
COPY resources/ resources/
COPY routes/ routes/
COPY forecasting/ forecasting/
COPY public/ public/
COPY --from=frontend /build/public/build/ public/build/
COPY frontend/public/ public/
RUN mkdir -p storage/app/public storage/app/private storage/framework/cache/data \
    storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader \
    && chown -R www-data:www-data storage bootstrap/cache
COPY deploy/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/ports.conf /etc/apache2/ports.conf
COPY deploy/php.ini /usr/local/etc/php/conf.d/99-libralearn.ini
COPY deploy/supervisord.conf /etc/supervisor/libralearn.conf
COPY deploy/start.sh /usr/local/bin/libralearn-start
COPY railway/ railway/
RUN sed -i 's/\r$//' /usr/local/bin/libralearn-start railway/*.sh \
    && chmod +x /usr/local/bin/libralearn-start
ENV PORT=10000 APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr \
    LIBRARY_FORECAST_PYTHON=/opt/forecast-venv/bin/python
EXPOSE 10000
CMD ["/usr/local/bin/libralearn-start"]
