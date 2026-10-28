# V2Ray VPN Integration

## Быстрый старт

### 1. Запуск проекта

```bash
docker-compose up --build
```

Эта команда автоматически:
- Соберёт оба контейнера (netpanel + v2ray)
- Запустит API сервер на порту 8080
- Запустит V2Ray VPN на порту 10808
- Запустит веб-панель

### 2. Доступ к панели

Откройте в браузере: `http://localhost:8080`

В панели вы увидите секцию **VPN CONNECTION** с:
- VLESS connection string (для копирования)
- Статус VPN сервера (ONLINE/OFFLINE)
- Детали подключения (host, port, UUID, path)

### 3. Использование VPN

1. Скопируйте VLESS connection string из панели (кнопка Copy)
2. Вставьте его в свой VPN клиент (v2rayN, v2rayNG, Shadowrocket и т.д.)
3. Подключитесь

## Конфигурация

### Изменить хост для внешнего доступа

Создайте файл `.env`:

```bash
VPN_HOST=ваш.домен.com
VPN_PUBLIC_PORT=443
VPN_SECURITY=tls
VPN_FINGERPRINT=random
VPN_ALPN=h3
```

`VPN_HOST` — публичный адрес, который используют клиенты. Если он не задан,
панель использует имя хоста текущего запроса. Порт V2Ray внутри контейнера
не является внешним портом клиента: задайте здесь порт, который открыт
пользователям (обычно `443` при TLS-прокси).

Для локального запуска через Nginx из `docker-compose.yml` оставьте значения
по умолчанию: порт `8080` и `VPN_SECURITY=none`. Если перед сервисом стоит
HTTPS-прокси, укажите внешний порт и режим TLS, например `443` и `tls`.

После изменения `.env` перезапустите:

```bash
docker-compose down
docker-compose up --build
```

## Развёртывание на Northflank

На Northflank используйте **Deployment Service с Dockerfile**, а не Docker
Compose: корневой `Dockerfile` собирает панель/API и запускает V2Ray в одном
контейнере.

1. Укажите корень репозитория как build context и `/Dockerfile` как Dockerfile.
2. Добавьте публичный порт контейнера `8080` с протоколом HTTP. Northflank
   обслуживает публичный HTTPS на `443`, завершает TLS на своей стороне и
   поддерживает WebSocket на HTTP-портах.
3. Не публикуйте внутренний порт V2Ray `10808` отдельно. Ссылка для клиента
   должна использовать внешний домен, порт `443`, TLS и WebSocket.
4. Northflank автоматически предоставляет домены в `NF_HOSTS`; для своего
   домена можно использовать `NF_HOSTS_CUSTOM`. Панель выбирает пользовательский
   `VPN_HOST`, если задан, иначе первый пользовательский или автоматически
   назначенный домен.
5. При необходимости задайте health check по адресу `/api/healthz`.

Публичный HTTP/WebSocket endpoint и внутренняя V2Ray-связь используют разные
порты: внешний HTTPS-порт клиента — `443`, порт приложения внутри контейнера —
`8080`, внутренний порт V2Ray — `10808`.

### Изменить UUID клиента

Отредактируйте `v2ray-config.json`:

```json
{
  "inbounds": [{
    "settings": {
      "clients": [{
        "id": "ВАШ-НОВЫЙ-UUID-ЗДЕСЬ"
      }]
    }
  }]
}
```

## Порты

- **8080** - внешний HTTP-порт локального Nginx в Docker Compose
- **10808** - внутренний порт V2Ray; он не обязательно совпадает с портом в VLESS-ссылке

## API Endpoints

- `GET /api/vpn/connection` - Получить VLESS connection string
- `GET /api/vpn/status` - Проверить статус VPN сервера

## Остановка

```bash
docker-compose down
```
