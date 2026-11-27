--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4 (Homebrew)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    store_id integer NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    prefix text NOT NULL,
    scopes text,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone
);


--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    store_id integer NOT NULL,
    user_id integer,
    action text NOT NULL,
    details text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: backup_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_history (
    id integer NOT NULL,
    store_id integer NOT NULL,
    filename text NOT NULL,
    file_size integer NOT NULL,
    backup_type text NOT NULL,
    status text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: backup_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.backup_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: backup_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.backup_history_id_seq OWNED BY public.backup_history.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    store_id integer NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    notes text,
    total_orders integer DEFAULT 0 NOT NULL,
    lifetime_value integer DEFAULT 0 NOT NULL,
    last_visit timestamp without time zone,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer,
    type text DEFAULT 'REGULAR'::text NOT NULL,
    is_system integer DEFAULT 0 NOT NULL,
    is_protected integer DEFAULT 0 NOT NULL
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: device_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_settings (
    id integer NOT NULL,
    store_id integer NOT NULL,
    device_id text NOT NULL,
    printer_profile text,
    scanner_profile text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: device_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_settings_id_seq OWNED BY public.device_settings.id;


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id integer NOT NULL,
    store_id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: expense_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_categories_id_seq OWNED BY public.expense_categories.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer NOT NULL,
    store_id integer NOT NULL,
    category_id integer NOT NULL,
    amount integer NOT NULL,
    payment_method text NOT NULL,
    vendor text,
    description text,
    date timestamp without time zone DEFAULT now() NOT NULL,
    receipt_image_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: google_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_integrations (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    store_id integer,
    google_user_id text,
    google_email text,
    refresh_token text NOT NULL,
    spreadsheet_id text,
    spreadsheet_name text,
    connected_at timestamp without time zone DEFAULT now() NOT NULL,
    last_sync timestamp without time zone,
    sync_enabled integer DEFAULT 1 NOT NULL,
    sync_method text DEFAULT 'oauth'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: google_integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.google_integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: google_integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.google_integrations_id_seq OWNED BY public.google_integrations.id;


--
-- Name: inventory_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_adjustments (
    id integer NOT NULL,
    store_id integer NOT NULL,
    product_id integer NOT NULL,
    type text NOT NULL,
    quantity integer NOT NULL,
    reason text NOT NULL,
    before_stock integer NOT NULL,
    after_stock integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: inventory_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_adjustments_id_seq OWNED BY public.inventory_adjustments.id;


--
-- Name: inventory_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_logs (
    id integer NOT NULL,
    product_id integer NOT NULL,
    store_id integer NOT NULL,
    type text NOT NULL,
    quantity integer NOT NULL,
    before_stock integer NOT NULL,
    after_stock integer NOT NULL,
    reference text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: inventory_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_logs_id_seq OWNED BY public.inventory_logs.id;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id integer NOT NULL,
    store_id integer NOT NULL,
    movement_type text NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    previous_stock integer NOT NULL,
    new_stock integer NOT NULL,
    reference_type text,
    reference_id text,
    reason text,
    created_by text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- Name: kot_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kot_items (
    id integer NOT NULL,
    organization_id integer,
    store_id integer,
    kot_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    product_name_snapshot text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: kot_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kot_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kot_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kot_items_id_seq OWNED BY public.kot_items.id;


--
-- Name: kots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kots (
    id integer NOT NULL,
    organization_id integer,
    store_id integer NOT NULL,
    sale_id integer NOT NULL,
    kot_number integer NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    table_no text,
    order_type text DEFAULT 'DINE_IN'::text NOT NULL,
    notes text,
    printed_at timestamp without time zone,
    reprint_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: kots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kots_id_seq OWNED BY public.kots.id;


--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_invitations (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'Manager'::text NOT NULL,
    token text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL
);


--
-- Name: organization_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_invitations_id_seq OWNED BY public.organization_invitations.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id integer NOT NULL,
    name text NOT NULL,
    billing_plan text DEFAULT 'Basic'::text NOT NULL,
    subscription_status text DEFAULT 'active'::text NOT NULL,
    razorpay_subscription_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    slug text,
    phone text,
    email text,
    status text DEFAULT 'active'::text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    gst_number text,
    pan_number text,
    address text,
    logo_url text,
    currency text DEFAULT 'INR'::text,
    timezone text DEFAULT 'Asia/Kolkata'::text,
    invoice_prefix text DEFAULT 'INV-'::text,
    financial_year text DEFAULT '2026-2027'::text,
    receipt_info text,
    onboarding_completed integer DEFAULT 0
);


--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: product_cost_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_cost_history (
    id integer NOT NULL,
    store_id integer NOT NULL,
    product_id integer NOT NULL,
    average_cost integer NOT NULL,
    effective_date timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: product_cost_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_cost_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_cost_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_cost_history_id_seq OWNED BY public.product_cost_history.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    store_id integer NOT NULL,
    name text NOT NULL,
    sku text NOT NULL,
    barcode text,
    category text,
    purchase_price integer NOT NULL,
    selling_price integer NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    minimum_stock integer DEFAULT 0 NOT NULL,
    gst integer DEFAULT 18 NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    image_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    margin_percent integer DEFAULT 0 NOT NULL,
    markup_percent integer DEFAULT 0 NOT NULL,
    average_cost integer DEFAULT 0 NOT NULL,
    last_purchase_cost integer DEFAULT 0 NOT NULL,
    max_stock integer DEFAULT 0 NOT NULL,
    reorder_quantity integer DEFAULT 0 NOT NULL,
    preferred_supplier_id integer,
    organization_id integer,
    is_kitchen_item integer DEFAULT 0 NOT NULL
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id integer NOT NULL,
    purchase_order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    purchase_price integer NOT NULL,
    line_total integer NOT NULL,
    received_quantity integer DEFAULT 0 NOT NULL,
    discount integer DEFAULT 0 NOT NULL,
    gst integer DEFAULT 0 NOT NULL,
    organization_id integer,
    store_id integer
);


--
-- Name: purchase_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_items_id_seq OWNED BY public.purchase_items.id;


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id integer NOT NULL,
    store_id integer NOT NULL,
    supplier_id integer NOT NULL,
    subtotal integer NOT NULL,
    discount integer DEFAULT 0 NOT NULL,
    grand_total integer NOT NULL,
    payment_status text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    supplier_invoice_number text,
    purchase_date timestamp without time zone DEFAULT now() NOT NULL,
    tax integer DEFAULT 0 NOT NULL,
    payment_method text,
    po_number text NOT NULL,
    status text DEFAULT 'COMPLETED'::text NOT NULL,
    expected_delivery timestamp without time zone,
    gst integer DEFAULT 0 NOT NULL,
    invoice_number text,
    invoice_date timestamp without time zone DEFAULT now(),
    transport_charges integer DEFAULT 0 NOT NULL,
    other_charges integer DEFAULT 0 NOT NULL,
    net_amount integer DEFAULT 0 NOT NULL,
    void_reason text,
    voided_by text,
    voided_at timestamp without time zone,
    created_by text DEFAULT 'System'::text,
    organization_id integer
);


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_orders_id_seq OWNED BY public.purchase_orders.id;


--
-- Name: return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_items (
    id integer NOT NULL,
    return_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    selling_price integer NOT NULL,
    refund_amount integer NOT NULL,
    organization_id integer,
    store_id integer
);


--
-- Name: return_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.return_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: return_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.return_items_id_seq OWNED BY public.return_items.id;


--
-- Name: returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.returns (
    id integer NOT NULL,
    store_id integer NOT NULL,
    original_sale_id integer NOT NULL,
    return_invoice_number text NOT NULL,
    subtotal integer NOT NULL,
    discount integer DEFAULT 0 NOT NULL,
    gst integer DEFAULT 0 NOT NULL,
    grand_total integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: returns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.returns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: returns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.returns_id_seq OWNED BY public.returns.id;


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    selling_price integer NOT NULL,
    discount integer DEFAULT 0 NOT NULL,
    line_total integer NOT NULL,
    organization_id integer,
    store_id integer
);


--
-- Name: sale_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sale_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sale_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sale_items_id_seq OWNED BY public.sale_items.id;


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id integer NOT NULL,
    store_id integer NOT NULL,
    invoice_number text NOT NULL,
    customer_id integer,
    cashier_name text,
    payment_method text NOT NULL,
    payment_details text,
    subtotal integer NOT NULL,
    discount integer DEFAULT 0 NOT NULL,
    gst integer DEFAULT 0 NOT NULL,
    grand_total integer NOT NULL,
    paid_amount integer DEFAULT 0 NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    public_token text,
    pdf_url text,
    shared_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'COMPLETED'::text NOT NULL,
    void_reason text,
    voided_by text,
    voided_at timestamp without time zone,
    organization_id integer
);


--
-- Name: sales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    store_id integer NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustments (
    id integer NOT NULL,
    store_id integer NOT NULL,
    product_id integer NOT NULL,
    adjustment_type text NOT NULL,
    quantity_before integer NOT NULL,
    quantity_change integer NOT NULL,
    quantity_after integer NOT NULL,
    reason text NOT NULL,
    notes text,
    created_by text DEFAULT 'System'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_adjustments_id_seq OWNED BY public.stock_adjustments.id;


--
-- Name: store_kot_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_kot_sequences (
    id integer NOT NULL,
    store_id integer NOT NULL,
    last_kot_number integer DEFAULT 0 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: store_kot_sequences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.store_kot_sequences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: store_kot_sequences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.store_kot_sequences_id_seq OWNED BY public.store_kot_sequences.id;


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id integer NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    gst_number text,
    logo_url text,
    currency text DEFAULT 'INR'::text NOT NULL,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer,
    code text,
    city text,
    state text,
    country text,
    is_default integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stores_id_seq OWNED BY public.stores.id;


--
-- Name: supplier_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_ledger (
    id integer NOT NULL,
    store_id integer NOT NULL,
    supplier_id integer NOT NULL,
    transaction_type text NOT NULL,
    amount integer NOT NULL,
    balance integer NOT NULL,
    reference text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: supplier_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_ledger_id_seq OWNED BY public.supplier_ledger.id;


--
-- Name: supplier_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_payments (
    id integer NOT NULL,
    store_id integer NOT NULL,
    supplier_id integer NOT NULL,
    amount integer NOT NULL,
    payment_method text NOT NULL,
    reference_number text,
    payment_date timestamp without time zone DEFAULT now() NOT NULL,
    notes text,
    payment_number text NOT NULL,
    created_by text DEFAULT 'System'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer
);


--
-- Name: supplier_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_payments_id_seq OWNED BY public.supplier_payments.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    store_id integer NOT NULL,
    phone text,
    email text,
    address text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    gstin text,
    is_archived integer DEFAULT 0 NOT NULL,
    current_balance integer DEFAULT 0 NOT NULL,
    supplier_code text DEFAULT 'SUP-000'::text,
    company_name text DEFAULT 'Supplier'::text,
    contact_person text,
    gst_number text,
    pan_number text,
    city text,
    state text,
    country text,
    postal_code text,
    opening_balance integer DEFAULT 0 NOT NULL,
    payment_terms text,
    credit_limit integer DEFAULT 0 NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    organization_id integer
);


--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id integer NOT NULL,
    organization_id integer NOT NULL,
    store_id integer NOT NULL,
    subject text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'Open'::text NOT NULL,
    priority text DEFAULT 'Medium'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: sync_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_history (
    id integer NOT NULL,
    store_id integer NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone,
    status text NOT NULL,
    records_synced integer DEFAULT 0 NOT NULL,
    error_message text,
    organization_id integer
);


--
-- Name: sync_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_history_id_seq OWNED BY public.sync_history.id;


--
-- Name: sync_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_jobs (
    id integer NOT NULL,
    store_id integer NOT NULL,
    job_type text NOT NULL,
    payload text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    error_message text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_attempt timestamp without time zone,
    organization_id integer
);


--
-- Name: sync_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sync_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_jobs_id_seq OWNED BY public.sync_jobs.id;


--
-- Name: user_store_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_store_access (
    id integer NOT NULL,
    user_id integer NOT NULL,
    store_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: user_store_access_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_store_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_store_access_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_store_access_id_seq OWNED BY public.user_store_access.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    password_hash text NOT NULL,
    role text NOT NULL,
    store_id integer NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    organization_id integer,
    status text DEFAULT 'active'::text NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: backup_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history ALTER COLUMN id SET DEFAULT nextval('public.backup_history_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: device_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_settings ALTER COLUMN id SET DEFAULT nextval('public.device_settings_id_seq'::regclass);


--
-- Name: expense_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories ALTER COLUMN id SET DEFAULT nextval('public.expense_categories_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: google_integrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_integrations ALTER COLUMN id SET DEFAULT nextval('public.google_integrations_id_seq'::regclass);


--
-- Name: inventory_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments ALTER COLUMN id SET DEFAULT nextval('public.inventory_adjustments_id_seq'::regclass);


--
-- Name: inventory_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs ALTER COLUMN id SET DEFAULT nextval('public.inventory_logs_id_seq'::regclass);


--
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- Name: kot_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items ALTER COLUMN id SET DEFAULT nextval('public.kot_items_id_seq'::regclass);


--
-- Name: kots id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kots ALTER COLUMN id SET DEFAULT nextval('public.kots_id_seq'::regclass);


--
-- Name: organization_invitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations ALTER COLUMN id SET DEFAULT nextval('public.organization_invitations_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: product_cost_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_cost_history ALTER COLUMN id SET DEFAULT nextval('public.product_cost_history_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: purchase_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items ALTER COLUMN id SET DEFAULT nextval('public.purchase_items_id_seq'::regclass);


--
-- Name: purchase_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders ALTER COLUMN id SET DEFAULT nextval('public.purchase_orders_id_seq'::regclass);


--
-- Name: return_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items ALTER COLUMN id SET DEFAULT nextval('public.return_items_id_seq'::regclass);


--
-- Name: returns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns ALTER COLUMN id SET DEFAULT nextval('public.returns_id_seq'::regclass);


--
-- Name: sale_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items ALTER COLUMN id SET DEFAULT nextval('public.sale_items_id_seq'::regclass);


--
-- Name: sales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);


--
-- Name: stock_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments ALTER COLUMN id SET DEFAULT nextval('public.stock_adjustments_id_seq'::regclass);


--
-- Name: store_kot_sequences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_kot_sequences ALTER COLUMN id SET DEFAULT nextval('public.store_kot_sequences_id_seq'::regclass);


--
-- Name: stores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores ALTER COLUMN id SET DEFAULT nextval('public.stores_id_seq'::regclass);


--
-- Name: supplier_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledger ALTER COLUMN id SET DEFAULT nextval('public.supplier_ledger_id_seq'::regclass);


--
-- Name: supplier_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments ALTER COLUMN id SET DEFAULT nextval('public.supplier_payments_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: sync_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_history ALTER COLUMN id SET DEFAULT nextval('public.sync_history_id_seq'::regclass);


--
-- Name: sync_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_jobs ALTER COLUMN id SET DEFAULT nextval('public.sync_jobs_id_seq'::regclass);


--
-- Name: user_store_access id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_access ALTER COLUMN id SET DEFAULT nextval('public.user_store_access_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_history backup_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: device_settings device_settings_device_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_settings
    ADD CONSTRAINT device_settings_device_id_unique UNIQUE (device_id);


--
-- Name: device_settings device_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_settings
    ADD CONSTRAINT device_settings_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: google_integrations google_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_integrations
    ADD CONSTRAINT google_integrations_pkey PRIMARY KEY (id);


--
-- Name: inventory_adjustments inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: inventory_logs inventory_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: kot_items kot_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items
    ADD CONSTRAINT kot_items_pkey PRIMARY KEY (id);


--
-- Name: kots kots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kots
    ADD CONSTRAINT kots_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_token_unique UNIQUE (token);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: product_cost_history product_cost_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_cost_history
    ADD CONSTRAINT product_cost_history_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: return_items return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);


--
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: settings settings_store_id_key_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_store_id_key_pk PRIMARY KEY (store_id, key);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: store_kot_sequences store_kot_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_kot_sequences
    ADD CONSTRAINT store_kot_sequences_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: supplier_ledger supplier_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledger
    ADD CONSTRAINT supplier_ledger_pkey PRIMARY KEY (id);


--
-- Name: supplier_payments supplier_payments_payment_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_payment_number_unique UNIQUE (payment_number);


--
-- Name: supplier_payments supplier_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: sync_history sync_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_history
    ADD CONSTRAINT sync_history_pkey PRIMARY KEY (id);


--
-- Name: sync_jobs sync_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_jobs
    ADD CONSTRAINT sync_jobs_pkey PRIMARY KEY (id);


--
-- Name: user_store_access user_store_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_access
    ADD CONSTRAINT user_store_access_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_customers_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_organization_id ON public.customers USING btree (organization_id);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (store_id, phone);


--
-- Name: idx_customers_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_store_active ON public.customers USING btree (store_id, is_active);


--
-- Name: idx_expense_categories_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_categories_organization_id ON public.expense_categories USING btree (organization_id);


--
-- Name: idx_expenses_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_organization_id ON public.expenses USING btree (organization_id);


--
-- Name: idx_expenses_store_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_store_date ON public.expenses USING btree (store_id, date);


--
-- Name: idx_google_integrations_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_google_integrations_org_id ON public.google_integrations USING btree (organization_id);


--
-- Name: idx_google_integrations_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_google_integrations_store_id ON public.google_integrations USING btree (store_id);


--
-- Name: idx_inv_adj_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_adj_organization_id ON public.inventory_adjustments USING btree (organization_id);


--
-- Name: idx_inv_adj_store_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_adj_store_created ON public.inventory_adjustments USING btree (store_id, created_at);


--
-- Name: idx_inv_logs_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_logs_organization_id ON public.inventory_logs USING btree (organization_id);


--
-- Name: idx_inv_logs_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_logs_product ON public.inventory_logs USING btree (product_id);


--
-- Name: idx_inv_logs_store; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_logs_store ON public.inventory_logs USING btree (store_id);


--
-- Name: idx_inv_mov_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inv_mov_organization_id ON public.inventory_movements USING btree (organization_id);


--
-- Name: idx_inventory_movements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_created_at ON public.inventory_movements USING btree (created_at);


--
-- Name: idx_inventory_movements_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_product_id ON public.inventory_movements USING btree (product_id);


--
-- Name: idx_inventory_movements_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_store_id ON public.inventory_movements USING btree (store_id);


--
-- Name: idx_kot_items_kot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kot_items_kot_id ON public.kot_items USING btree (kot_id);


--
-- Name: idx_kot_items_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kot_items_organization_id ON public.kot_items USING btree (organization_id);


--
-- Name: idx_kot_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kot_items_product_id ON public.kot_items USING btree (product_id);


--
-- Name: idx_kot_items_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kot_items_store_id ON public.kot_items USING btree (store_id);


--
-- Name: idx_kots_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kots_organization_id ON public.kots USING btree (organization_id);


--
-- Name: idx_kots_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kots_sale_id ON public.kots USING btree (sale_id);


--
-- Name: idx_kots_store_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kots_store_created ON public.kots USING btree (store_id, created_at);


--
-- Name: idx_kots_store_kot_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_kots_store_kot_number ON public.kots USING btree (store_id, kot_number);


--
-- Name: idx_kots_store_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kots_store_status ON public.kots USING btree (store_id, status);


--
-- Name: idx_organizations_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_organizations_slug ON public.organizations USING btree (slug);


--
-- Name: idx_pch_effective_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pch_effective_date ON public.product_cost_history USING btree (effective_date);


--
-- Name: idx_pch_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pch_organization_id ON public.product_cost_history USING btree (organization_id);


--
-- Name: idx_pch_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pch_product_id ON public.product_cost_history USING btree (product_id);


--
-- Name: idx_pch_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pch_store_id ON public.product_cost_history USING btree (store_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_barcode ON public.products USING btree (store_id, barcode);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category);


--
-- Name: idx_products_kitchen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_kitchen ON public.products USING btree (store_id, is_kitchen_item);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_name ON public.products USING btree (name);


--
-- Name: idx_products_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_organization_id ON public.products USING btree (organization_id);


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_sku ON public.products USING btree (store_id, sku);


--
-- Name: idx_products_store_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_store_active ON public.products USING btree (store_id, is_active);


--
-- Name: idx_purchase_items_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_organization_id ON public.purchase_items USING btree (organization_id);


--
-- Name: idx_purchase_items_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_po_id ON public.purchase_items USING btree (purchase_order_id);


--
-- Name: idx_purchase_items_prod_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_prod_id ON public.purchase_items USING btree (product_id);


--
-- Name: idx_purchase_items_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_items_store_id ON public.purchase_items USING btree (store_id);


--
-- Name: idx_purchase_orders_num; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_purchase_orders_num ON public.purchase_orders USING btree (po_number);


--
-- Name: idx_purchase_orders_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_organization_id ON public.purchase_orders USING btree (organization_id);


--
-- Name: idx_purchase_orders_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_store_id ON public.purchase_orders USING btree (store_id);


--
-- Name: idx_purchase_orders_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders USING btree (supplier_id);


--
-- Name: idx_return_items_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_items_organization_id ON public.return_items USING btree (organization_id);


--
-- Name: idx_return_items_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_items_store_id ON public.return_items USING btree (store_id);


--
-- Name: idx_returns_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_invoice_number ON public.returns USING btree (store_id, return_invoice_number);


--
-- Name: idx_returns_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_organization_id ON public.returns USING btree (organization_id);


--
-- Name: idx_sale_items_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_organization_id ON public.sale_items USING btree (organization_id);


--
-- Name: idx_sale_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_product_id ON public.sale_items USING btree (product_id);


--
-- Name: idx_sale_items_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_sale_id ON public.sale_items USING btree (sale_id);


--
-- Name: idx_sale_items_sale_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_sale_product ON public.sale_items USING btree (sale_id, product_id);


--
-- Name: idx_sale_items_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_store_id ON public.sale_items USING btree (store_id);


--
-- Name: idx_sales_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_created_at ON public.sales USING btree (created_at);


--
-- Name: idx_sales_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_customer_id ON public.sales USING btree (customer_id);


--
-- Name: idx_sales_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_invoice_number ON public.sales USING btree (store_id, invoice_number);


--
-- Name: idx_sales_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_organization_id ON public.sales USING btree (organization_id);


--
-- Name: idx_sales_public_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_sales_public_token ON public.sales USING btree (public_token);


--
-- Name: idx_sales_store_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_store_created ON public.sales USING btree (store_id, created_at);


--
-- Name: idx_sales_store_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_store_status_created ON public.sales USING btree (store_id, status, created_at);


--
-- Name: idx_stock_adjustments_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_product_id ON public.stock_adjustments USING btree (product_id);


--
-- Name: idx_stock_adjustments_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_store_id ON public.stock_adjustments USING btree (store_id);


--
-- Name: idx_stock_adjustments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_type ON public.stock_adjustments USING btree (adjustment_type);


--
-- Name: idx_store_kot_sequences_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_store_kot_sequences_store_id ON public.store_kot_sequences USING btree (store_id);


--
-- Name: idx_supplier_ledger_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_ledger_organization_id ON public.supplier_ledger USING btree (organization_id);


--
-- Name: idx_supplier_ledger_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_ledger_store_id ON public.supplier_ledger USING btree (store_id);


--
-- Name: idx_supplier_ledger_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_ledger_supplier_id ON public.supplier_ledger USING btree (supplier_id);


--
-- Name: idx_supplier_payments_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payments_number ON public.supplier_payments USING btree (payment_number);


--
-- Name: idx_supplier_payments_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payments_organization_id ON public.supplier_payments USING btree (organization_id);


--
-- Name: idx_supplier_payments_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payments_store_id ON public.supplier_payments USING btree (store_id);


--
-- Name: idx_supplier_payments_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payments_supplier_id ON public.supplier_payments USING btree (supplier_id);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (name);


--
-- Name: idx_suppliers_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_organization_id ON public.suppliers USING btree (organization_id);


--
-- Name: idx_suppliers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_phone ON public.suppliers USING btree (store_id, phone);


--
-- Name: idx_suppliers_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_store_id ON public.suppliers USING btree (store_id);


--
-- Name: idx_sync_jobs_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_jobs_organization_id ON public.sync_jobs USING btree (organization_id);


--
-- Name: idx_sync_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_jobs_status ON public.sync_jobs USING btree (status);


--
-- Name: idx_sync_jobs_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sync_jobs_store_id ON public.sync_jobs USING btree (store_id);


--
-- Name: idx_user_store_access_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_store_access_store_id ON public.user_store_access USING btree (store_id);


--
-- Name: idx_user_store_access_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_store_access_user_id ON public.user_store_access USING btree (user_id);


--
-- Name: idx_user_store_access_user_store; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_store_access_user_store ON public.user_store_access USING btree (user_id, store_id);


--
-- Name: api_keys api_keys_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: api_keys api_keys_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: audit_logs audit_logs_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: audit_logs audit_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: backup_history backup_history_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: customers customers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customers customers_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: device_settings device_settings_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_settings
    ADD CONSTRAINT device_settings_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: expense_categories expense_categories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: expense_categories expense_categories_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: expenses expenses_category_id_expense_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_expense_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.expense_categories(id);


--
-- Name: expenses expenses_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: expenses expenses_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: google_integrations google_integrations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_integrations
    ADD CONSTRAINT google_integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: google_integrations google_integrations_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_integrations
    ADD CONSTRAINT google_integrations_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: inventory_adjustments inventory_adjustments_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_adjustments inventory_adjustments_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_adjustments inventory_adjustments_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: inventory_logs inventory_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_logs inventory_logs_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_logs inventory_logs_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: inventory_movements inventory_movements_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_movements inventory_movements_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: kot_items kot_items_kot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items
    ADD CONSTRAINT kot_items_kot_id_fkey FOREIGN KEY (kot_id) REFERENCES public.kots(id) ON DELETE CASCADE;


--
-- Name: kot_items kot_items_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items
    ADD CONSTRAINT kot_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: kot_items kot_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items
    ADD CONSTRAINT kot_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: kot_items kot_items_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kot_items
    ADD CONSTRAINT kot_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: kots kots_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kots
    ADD CONSTRAINT kots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: kots kots_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kots
    ADD CONSTRAINT kots_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: kots kots_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kots
    ADD CONSTRAINT kots_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: organization_invitations organization_invitations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: product_cost_history product_cost_history_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_cost_history
    ADD CONSTRAINT product_cost_history_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_cost_history product_cost_history_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_cost_history
    ADD CONSTRAINT product_cost_history_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: product_cost_history product_cost_history_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_cost_history
    ADD CONSTRAINT product_cost_history_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: products products_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: purchase_items purchase_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_items purchase_items_purchase_order_id_purchase_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_order_id_purchase_orders_id_fk FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_items purchase_items_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_orders purchase_orders_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: purchase_orders purchase_orders_supplier_id_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: return_items return_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: return_items return_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: return_items return_items_return_id_returns_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_return_id_returns_id_fk FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE CASCADE;


--
-- Name: return_items return_items_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: returns returns_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: returns returns_original_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_original_sale_id_sales_id_fk FOREIGN KEY (original_sale_id) REFERENCES public.sales(id);


--
-- Name: returns returns_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: sale_items sale_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sale_items sale_items_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sale_items sale_items_sale_id_sales_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_sales_id_fk FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_customer_id_customers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_customers_id_fk FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sales sales_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales sales_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: settings settings_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: stock_adjustments stock_adjustments_product_id_products_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_adjustments stock_adjustments_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_kot_sequences store_kot_sequences_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_kot_sequences
    ADD CONSTRAINT store_kot_sequences_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: stores stores_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_ledger supplier_ledger_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledger
    ADD CONSTRAINT supplier_ledger_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_ledger supplier_ledger_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledger
    ADD CONSTRAINT supplier_ledger_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: supplier_ledger supplier_ledger_supplier_id_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_ledger
    ADD CONSTRAINT supplier_ledger_supplier_id_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: supplier_payments supplier_payments_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_payments supplier_payments_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: supplier_payments supplier_payments_supplier_id_suppliers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_supplier_id_suppliers_id_fk FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: suppliers suppliers_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: suppliers suppliers_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: support_tickets support_tickets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: support_tickets support_tickets_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: sync_history sync_history_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_history
    ADD CONSTRAINT sync_history_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: sync_jobs sync_jobs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_jobs
    ADD CONSTRAINT sync_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sync_jobs sync_jobs_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_jobs
    ADD CONSTRAINT sync_jobs_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: user_store_access user_store_access_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_access
    ADD CONSTRAINT user_store_access_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_store_access user_store_access_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_access
    ADD CONSTRAINT user_store_access_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_store_id_stores_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_store_id_stores_id_fk FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- PostgreSQL database dump complete
--


