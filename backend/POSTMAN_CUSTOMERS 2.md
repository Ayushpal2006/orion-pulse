# Orion POS Customer API Documentation

This collection contains example cURL requests to test the Orion POS Customer API endpoints.

The base URL for the API is `http://localhost:8080`.

---

## 1. Get All Customers (GET)
Retrieves all customers in the database, ordered by insertion sequence (newest first).

* **URL:** `/customers`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/customers
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "name": "Manish Joshi",
      "phone": "9876543217",
      "email": "manish@example.com",
      "address": "Indore",
      "notes": null,
      "total_orders": 1,
      "lifetime_value": 250000,
      "last_visit": "2026-07-09 13:00:00",
      "created_at": "2026-07-09 12:35:00",
      "updated_at": "2026-07-09 12:35:00"
    },
    ...
  ]
}
```

---

## 2. Get Customer By ID (GET)
Retrieves details of a customer by their unique database ID.

* **URL:** `/customers/:id`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/customers/1
```

### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Rahul Sharma",
    "phone": "8285068670",
    "email": "rahul@example.com",
    "address": "Delhi",
    "notes": "Regular customer, prefers weekend visits",
    "total_orders": 5,
    "lifetime_value": 1200000,
    "last_visit": "2026-07-01 10:30:00",
    "created_at": "2026-07-09 12:35:00",
    "updated_at": "2026-07-09 12:35:00"
  }
}
```

### Response - Not Found (404)
```json
{
  "success": false,
  "message": "Not Found",
  "error": "Customer with ID 999 not found"
}
```

---

## 3. Get Customer By Phone (GET)
Performs a fast exact-match lookup of a customer by their phone number.

* **URL:** `/customers/phone/:phone`
* **Method:** `GET`

### Example Request
```bash
curl http://localhost:8080/customers/phone/9811122233
```

### Response
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Priya Verma",
    "phone": "9811122233",
    "email": "priya@example.com",
    "address": "Mumbai",
    "notes": "VIP customer, high value, interested in boutique fashion",
    "total_orders": 12,
    "lifetime_value": 3500000,
    "last_visit": "2026-07-05 14:15:00",
    "created_at": "2026-07-09 12:35:00",
    "updated_at": "2026-07-09 12:35:00"
  }
}
```

---

## 4. Search Customers (GET)
Search customers by Name or Phone (substring match).

* **URL:** `/customers/search?q=:query`
* **Method:** `GET`

### Example Request
```bash
curl "http://localhost:8080/customers/search?q=Sharma"
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Rahul Sharma",
      "phone": "8285068670",
      "email": "rahul@example.com",
      "address": "Delhi",
      "notes": "Regular customer, prefers weekend visits",
      "total_orders": 5,
      "lifetime_value": 1200000,
      "last_visit": "2026-07-01 10:30:00",
      "created_at": "2026-07-09 12:35:00",
      "updated_at": "2026-07-09 12:35:00"
    }
  ]
}
```

---

## 5. Create Customer (POST)
Creates a new customer. The phone number must be unique and exactly 10 digits.

* **URL:** `/customers`
* **Method:** `POST`
* **Headers:** `Content-Type: application/json`

### Success Example Request
```bash
curl -X POST http://localhost:8080/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rahul Sharma",
    "phone": "8285068670",
    "email": "rahul@example.com",
    "address": "Delhi"
  }'
```

### Response - Conflict Error (409)
If the phone number already exists:
```json
{
  "success": false,
  "message": "Conflict Error",
  "error": "Phone number \"8285068670\" already exists"
}
```

### Response - Validation Error (400)
If the phone number is not exactly 10 digits:
```json
{
  "success": false,
  "message": "Validation Error",
  "error": "phone: Phone number must be exactly 10 digits"
}
```

---

## 6. Update Customer (PUT)
Updates field values of an existing customer.

* **URL:** `/customers/:id`
* **Method:** `PUT`
* **Headers:** `Content-Type: application/json`

### Example Request (Update address and notes)
```bash
curl -X PUT http://localhost:8080/customers/1 \
  -H "Content-Type: application/json" \
  -d '{
    "address": "New Delhi, Connaught Place",
    "notes": "Prefers premium packaging"
  }'
```

### Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Rahul Sharma",
    "phone": "8285068670",
    "email": "rahul@example.com",
    "address": "New Delhi, Connaught Place",
    "notes": "Prefers premium packaging",
    "total_orders": 5,
    "lifetime_value": 1200000,
    "last_visit": "2026-07-01 10:30:00",
    "created_at": "2026-07-09 12:35:00",
    "updated_at": "2026-07-09 12:37:12"
  }
}
```

---

## 7. Delete Customer (DELETE)
Removes a customer record from the database.

* **URL:** `/customers/:id`
* **Method:** `DELETE`

### Example Request
```bash
curl -X DELETE http://localhost:8080/customers/1
```

### Response
```json
{
  "success": true,
  "data": null
}
```
