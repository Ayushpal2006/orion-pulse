# Orion POS Products API Documentation

This collection contains example cURL requests to test the Orion POS Products API.

The base URL for the API is `http://localhost:8080`.

---

## 1. Create Product (POST)
Creates a new product in the SQLite database. Values for prices (`purchase_price` and `selling_price`) are integers representing paise (e.g., `80000` = Rs. 800.00).

* **URL:** `/products`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`

### Success Example Request (BJ001 - Blue Denim Jeans)
```bash
curl -X POST http://localhost:8080/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Blue Denim Jeans",
    "sku": "BJ001",
    "barcode": "8901234567891",
    "category": "Jeans",
    "purchase_price": 80000,
    "selling_price": 120000,
    "stock": 25,
    "minimum_stock": 5,
    "gst": 18
  }'
```

### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Blue Denim Jeans",
    "sku": "BJ001",
    "barcode": "8901234567891",
    "category": "Jeans",
    "purchase_price": 80000,
    "selling_price": 120000,
    "stock": 25,
    "minimum_stock": 5,
    "gst": 18,
    "created_at": "2026-07-09 17:55:00",
    "updated_at": "2026-07-09 17:55:00"
  }
}
```

### Business Validation Error Example (Selling price < Purchase price)
```bash
curl -X POST http://localhost:8080/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid Price Jeans",
    "sku": "BJ002",
    "purchase_price": 80000,
    "selling_price": 70000
  }'
```

### Response
```json
{
  "success": false,
  "message": "Business Validation Error",
  "error": "Selling price cannot be less than purchase price"
}
```

---

## 2. Get All Products (GET)
Retrieves all products from the database, sorted by insertion order (newest first).

* **URL:** `/products`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/products
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Blue Denim Jeans",
      "sku": "BJ001",
      "barcode": "8901234567891",
      "category": "Jeans",
      "purchase_price": 80000,
      "selling_price": 120000,
      "stock": 25,
      "minimum_stock": 5,
      "gst": 18,
      "created_at": "2026-07-09 17:55:00",
      "updated_at": "2026-07-09 17:55:00"
    }
  ]
}
```

---

## 3. Get Product By ID (GET)
Retrieves a single product details.

* **URL:** `/products/:id`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/products/1
```

### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Blue Denim Jeans",
    "sku": "BJ001",
    "barcode": "8901234567891",
    "category": "Jeans",
    "purchase_price": 80000,
    "selling_price": 120000,
    "stock": 25,
    "minimum_stock": 5,
    "gst": 18,
    "created_at": "2026-07-09 17:55:00",
    "updated_at": "2026-07-09 17:55:00"
  }
}
```

---

## 4. Search Products (GET)
Search products by Name, SKU, or Barcode (case-insensitive substring matches).

* **URL:** `/products/search?q=:query`
* **Method:** `GET`

### Example Request (Search for "BJ001")
```bash
curl "http://localhost:8080/products/search?q=BJ001"
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Blue Denim Jeans",
      "sku": "BJ001",
      "barcode": "8901234567891",
      "category": "Jeans",
      "purchase_price": 80000,
      "selling_price": 120000,
      "stock": 25,
      "minimum_stock": 5,
      "gst": 18,
      "created_at": "2026-07-09 17:55:00",
      "updated_at": "2026-07-09 17:55:00"
    }
  ]
}
```

---

## 5. Update Product (PUT)
Updates field values of an existing product. Only provided fields are updated.

* **URL:** `/products/:id`
* **Method:** `PUT`
* **Headers:** `Content-Type: application/json`

### Example Request (Update stock to 30)
```bash
curl -X PUT http://localhost:8080/products/1 \
  -H "Content-Type: application/json" \
  -d '{
    "stock": 30
  }'
```

### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Blue Denim Jeans",
    "sku": "BJ001",
    "barcode": "8901234567891",
    "category": "Jeans",
    "purchase_price": 80000,
    "selling_price": 120000,
    "stock": 30,
    "minimum_stock": 5,
    "gst": 18,
    "created_at": "2026-07-09 17:55:00",
    "updated_at": "2026-07-09 17:56:15"
  }
}
```

---

## 6. Delete Product (DELETE)
Removes a product from the database.

* **URL:** `/products/:id`
* **Method:** `DELETE`

### Example Request
```bash
curl -X DELETE http://localhost:8080/products/1
```

### Response
```json
{
  "success": true,
  "data": null
}
```
