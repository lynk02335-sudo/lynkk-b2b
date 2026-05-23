ALTER TABLE tracked_users 
ADD CONSTRAINT tracked_users_customer_email_unique 
UNIQUE (customer_id, email);
