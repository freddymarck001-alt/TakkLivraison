/*
# Add GPS tracker ID to motos table

1. Modified Tables
- `motos`
- Add `gps_identifiant` column (text, nullable) - unique identifier for GPS tracker
- Add `gps_status` column (text, default 'non_connecte') - enum: 'connecte', 'non_connecte', 'hors_ligne'

2. Notes
- GPS fields are optional - can be filled when tracker is installed
- When gps_identifiant is null, moto shows as "GPS non connecté"
*/

ALTER TABLE motos 
ADD COLUMN IF NOT EXISTS gps_identifiant TEXT,
ADD COLUMN IF NOT EXISTS gps_status TEXT DEFAULT 'non_connecte';

CREATE INDEX IF NOT EXISTS idx_motos_gps_identifiant ON motos(gps_identifiant) WHERE gps_identifiant IS NOT NULL;
