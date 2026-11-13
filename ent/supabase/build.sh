#!/bin/sh
# Assemble le fichier unique à coller dans « SQL Editor » de Supabase (une seule fois, sur un projet neuf).
cd "$(dirname "$0")"
{ echo "-- ENT Chateaubriand — installation complète pour Supabase (généré par build.sh, ne pas modifier à la main)"
  cat ../db/schema.sql ../db/functions.sql ../db/seed.sql 10_supabase.sql 20_comptes.sql 30_carnets.sql 40_eleves.sql; } > installation.sql
echo "installation.sql : $(wc -l < installation.sql) lignes"
