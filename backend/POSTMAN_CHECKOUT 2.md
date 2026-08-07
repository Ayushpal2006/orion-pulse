# Orion POS Sales & Checkout API Documentation

This collection contains example cURL requests to test the Orion POS Sales & Checkout Engine.

The base URL for the API is `http://localhost:8080`.

---

## 1. Create Sale / Checkout (POST)
Executes a POS checkout transaction. If the customer does not exist, they are auto-created. The entire checkout runs inside a single SQLite transaction (atomic).

* **URL:** `/checkout`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`

### Example Request
```bash
curl -X POST http://localhost:8080/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "8285068670",
    "paymentMethod": "UPI",
    "cashierName": "Admin",
    "items": [
      {
        "productId": 1,
        "quantity": 2
      }
    ]
  }'
```

### Response
```json
{
  "success": true,
  "invoice": "INV-2026-000001",
  "saleId": 1,
  "subtotal": 240000,
  "discount": 0,
  "gst": 43200,
  "grandTotal": 283200,
  "items": [
    {
      "productId": 1,
      "name": "Blue Denim Jeans",
      "quantity": 2,
      "sellingPrice": 120000,
      "lineTotal": 240000
    }
  ]
}
```

---

## 2. Get All Sales (GET)
Retrieves all completed sales in the system, sorted by latest transaction first.

* **URL:** `/sales`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/sales
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoice_number": "INV-2026-000001",
      "customer_id": 1,
      "cashier_name": "Admin",
      "payment_method": "UPI",
      "subtotal": 240000,
      "discount": 0,
      "gst": 43200,
      "grand_total": 283200,
      "created_at": "2026-07-09 12:44:00"
    }
  ]
}
```

---

## 3. Get Sale By ID (GET)
Loads full details of a specific sale including sale header, customer profile, individual line items, and totals breakdown.

* **URL:** `/sales/:id`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/sales/1
```

### Response
```json
{
  "success": true,
  "data": {
    "sale": {
      "id": 1,
      "invoice_number": "INV-2026-000001",
      "customer_id": 1,
      "cashier_name": "Admin",
      "payment_method": "UPI",
      "subtotal": 240000,
      "discount": 0,
      "gst": 43200,
      "grand_total": 283200,
      "created_at": "2026-07-09 12:44:00"
    },
    "customer": {
      "id": 1,
      "name": "Rahul Sharma",
      "phone": "8285068670",
      "email": "rahul@example.com",
      "address": "Delhi",
      "notes": "Regular customer, prefers weekend visits",
      "total_orders": 6,
      "lifetime_value": 1483200,
      "last_visit": "2026-07-09 12:44:00",
      "created_at": "2026-07-09 12:34:44",
      "updated_at": "2026-07-09 12:44:00"
    },
    "items": [
      {
        "id": 1,
        "sale_id": 1,
        "product_id": 1,
        "quantity": 2,
        "selling_price": 120000,
        "discount": 0,
        "line_total": 240000,
        "product_name": "Blue Denim Jeans",
        "product_sku": "BJ001"
      }
    ],
    "totals": {
      "subtotal": 240000,
      "discount": 0,
      "gst": 43200,
      "grand_total": 283200
    }
  }
}
```

---

## 4. Get Sale By Invoice Number (GET)
Loads sale details by the sequential invoice number.

* **URL:** `/sales/invoice/:invoice`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/sales/invoice/INV-2026-000001
```

### Response
```json
{
  "success": true,
  "data": {
    "sale": {
      "id": 1,
      "invoice_number": "INV-2026-000001",
      "customer_id": 1,
      "cashier_name": "Admin",
      "payment_method": "UPI",
      "subtotal": 240000,
      "discount": 0,
      "gst": 43200,
      "grand_total": 283200,
      "created_at": "2026-07-09 12:44:00"
    },
    "customer": {
      "id": 1,
      "name": "Rahul Sharma",
      "phone": "8285068670",
      "email": "rahul@example.com",
      "address": "Delhi",
      "notes": "Regular customer, prefers weekend visits",
      "total_orders": 6,
      "lifetime_value": 1483200,
      "last_visit": "2026-07-09 12:44:00",
      "created_at": "2026-07-09 12:34:44",
      "updated_at": "2026-07-09 12:44:00"
    },
    "items": [
      {
        "id": 1,
        "sale_id": 1,
        "product_id": 1,
        "quantity": 2,
        "selling_price": 120000,
        "discount": 0,
        "line_total": 240000,
        "product_name": "Blue Denim Jeans",
        "product_sku": "BJ001"
      }
    ],
    "totals": {
      "subtotal": 240000,
      "discount": 0,
      "gst": 43200,
      "grand_total": 283200
    }
  }
}
```

---

## 5. Get Today's Sales (GET)
Filters sales completed on the current calendar date (local timezone).

* **URL:** `/sales/today`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/sales/today
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "invoice_number": "INV-2026-000001",
      "customer_id": 1,
      "cashier_name": "Admin",
      "payment_method": "UPI",
      "subtotal": 240000,
      "discount": 0,
      "gst": 43200,
      "grand_total": 283200,
      "created_at": "2026-07-09 12:44:00"
    }
  ]
}
```
