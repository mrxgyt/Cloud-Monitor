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
# или ваш публичный IP:
# VPN_HOST=123.45.67.89
```

Затем перезапустите:

```bash
docker-compose down
docker-compose up --build
```

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

- **8080** - API сервер + веб-панель
- **10808** - V2Ray VPN сервер

## API Endpoints

- `GET /api/vpn/connection` - Получить VLESS connection string
- `GET /api/vpn/status` - Проверить статус VPN сервера

## Остановка

```bash
docker-compose down
```
