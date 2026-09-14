SELECT 'CREATE DATABASE seven_suite_test'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'seven_suite_test'
)\gexec
