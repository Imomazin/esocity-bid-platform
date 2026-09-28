-- Runs once when the local PostgreSQL volume is first created (docker compose).
-- Creates the integration-test database next to the development database "esocity".
CREATE DATABASE esocity_test;
