-- Migration 00003a: Ampliar enum user_role
--
-- IMPORTANTE: Ejecutar este archivo PRIMERO y por separado.
-- PostgreSQL no permite usar nuevos valores de enum en la misma
-- transacción en que fueron añadidos. Después de ejecutar este
-- archivo, ejecuta 00003b_roles_orgchart.sql en una segunda pasada.
--
-- Prerequisito: 00002_entities.sql

alter type public.user_role add value if not exists 'manager' after 'employee';
alter type public.user_role add value if not exists 'hr' after 'manager';
