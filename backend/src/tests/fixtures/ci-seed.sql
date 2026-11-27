-- Minimal rows the DB-backed auth tests expect (organization 1 / store 1). No real data.
INSERT INTO organizations (id, name, slug, status) VALUES (1, 'CI Org', 'ci-org', 'active') ON CONFLICT DO NOTHING;
INSERT INTO stores (id, organization_id, name, code) VALUES (1, 1, 'CI Store', 'CI-01') ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('organizations','id'), (SELECT max(id) FROM organizations));
SELECT setval(pg_get_serial_sequence('stores','id'), (SELECT max(id) FROM stores));
