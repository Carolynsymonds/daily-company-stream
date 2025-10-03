-- Add column to track total results from API
ALTER TABLE scraper_runs 
ADD COLUMN total_results_from_api integer;

COMMENT ON COLUMN scraper_runs.total_results_from_api IS 'Total number of companies incorporated on the target date according to the API';