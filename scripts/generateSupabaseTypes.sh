#!/usr/bin/env bash

yarn -s run supabase gen types typescript --project-id elokscrfhzodpgvaixfd --schema public > types/supabase-notification.ts
yarn -s run supabase gen types typescript --project-id pyyfdntuqbsfquzzatkz --schema public > types/supabase-datalake.ts

