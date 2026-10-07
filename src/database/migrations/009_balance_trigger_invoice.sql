CREATE OR REPLACE FUNCTION set_credit_transaction_balances()
RETURNS TRIGGER AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
BEGIN
    -- Lock customer row to prevent race conditions
    SELECT current_balance
    INTO v_current_balance
    FROM credit_customers
    WHERE id = NEW.credit_customer_id
    FOR UPDATE;

    -- Fill balance_before
    NEW.balance_before := v_current_balance;

    -- Calculate balance_after
    IF NEW.transaction_type IN ('charge', 'opening_balance', 'adjustment') THEN
        NEW.balance_after := v_current_balance + NEW.amount;
    ELSE
        -- For payments or credit notes
        NEW.balance_after := v_current_balance - NEW.amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_credit_transaction_balances
BEFORE INSERT ON credit_transactions
FOR EACH ROW
EXECUTE FUNCTION set_credit_transaction_balances();

