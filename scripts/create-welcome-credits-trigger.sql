-- Create function to give welcome credits to new freelancers
CREATE OR REPLACE FUNCTION give_welcome_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Only give credits to freelancers
  IF NEW.account_type = 'freelancer' THEN
    -- Insert 80 free credits into purchase_credits table
    INSERT INTO purchase_credits (
      freelancer_id,
      amount,
      credits_amount,
      status,
      paystack_reference,
      created_at
    ) VALUES (
      NEW.id,
      0, -- Free credits, no cost
      80, -- 80 welcome credits
      'completed',
      'welcome_bonus_' || NEW.id || '_' || extract(epoch from now()),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires after new profile is inserted
DROP TRIGGER IF EXISTS welcome_credits_trigger ON profiles;
CREATE TRIGGER welcome_credits_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION give_welcome_credits();

-- Give retroactive credits to existing freelancers who don't have any credits yet
INSERT INTO purchase_credits (
  freelancer_id,
  amount,
  credits_amount,
  status,
  paystack_reference,
  created_at
)
SELECT 
  p.id,
  0,
  80,
  'completed',
  'retroactive_welcome_' || p.id || '_' || extract(epoch from now()),
  NOW()
FROM profiles p
LEFT JOIN purchase_credits pc ON p.id = pc.freelancer_id
WHERE p.account_type = 'freelancer' 
  AND pc.freelancer_id IS NULL;
