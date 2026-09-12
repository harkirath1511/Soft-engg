-- seed.sql: Sample seed data for demo and integration verification
-- Attach triggers first
CALL replaydb.attach_capture_trigger('users');
CALL replaydb.attach_capture_trigger('accounts');
CALL replaydb.attach_capture_trigger('orders');
CALL replaydb.attach_capture_trigger('inventory');

-- Normal System Operations: Seed records (these trigger capture events automatically)
INSERT INTO public.users (id, username, email, balance, status) VALUES
    (1, 'alice', 'alice@example.com', 500.00, 'ACTIVE'),
    (2, 'bob', 'bob@example.com', 1200.00, 'ACTIVE'),
    (3, 'charlie', 'charlie@example.com', 250.00, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.accounts (id, user_id, account_number, tier, credit_limit) VALUES
    (1, 1, 'ACC-US-00101', 'GOLD', 5000.00),
    (2, 2, 'ACC-US-00102', 'PLATINUM', 10000.00),
    (3, 3, 'ACC-US-00103', 'STANDARD', 1000.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inventory (id, sku, product_name, stock_quantity, reserved_quantity, unit_price) VALUES
    (1, 'SKU-LAPTOP-X1', 'UltraBook Pro 15', 50, 2, 1299.99),
    (2, 'SKU-MOUSE-WL', 'Precision Wireless Mouse', 150, 5, 49.99),
    (3, 'SKU-KEYB-MECH', 'Mechanical RGB Keyboard', 80, 0, 119.50)
ON CONFLICT (id) DO NOTHING;

-- Alice deposits funds: Step 1 evolution
UPDATE public.users SET balance = 750.00, updated_at = clock_timestamp() WHERE id = 1;
UPDATE public.users SET balance = 1000.00, updated_at = clock_timestamp() WHERE id = 1;

-- Simulated transaction order
INSERT INTO public.orders (id, user_id, total_amount, status, item_count) VALUES
    (1, 1, 49.99, 'CONFIRMED', 1)
ON CONFLICT (id) DO NOTHING;
