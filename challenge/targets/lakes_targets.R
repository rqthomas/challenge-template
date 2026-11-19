# Lakes targets: daily mean surface water temperature at three lakes.
#
# An example of a targets script. Its data come from a public file (the NEON
# Ecological Forecasting Challenge's aquatics targets), so it runs without any
# keys. Replace the "Download and clean" section with your own data source;
# keep the last three steps, which every targets script ends with.
#
# Run from the repository root:  Rscript challenge/targets/lakes_targets.R
#
# Environment variables
#   OSN_KEY, OSN_SECRET  main store, for the upload
#   DRY_RUN=true         write the targets to a local folder instead

library(challengeci)

cfg <- read_config()
minioclient::install_mc()
sites <- read_sites(cfg, "Lakes")

# Download and clean ----------------------------------------------------------
# Any code that ends with one row per site, datetime and variable, with an
# `observation` column. Datetimes are in UTC; NA observations are allowed.
source_url <- paste0("https://sdsc.osn.xsede.org/bio230014-bucket01/challenges/targets/",
                     "project_id=neon4cast/duration=P1D/aquatics-targets.csv.gz")

observations <- readr::read_csv(source_url, show_col_types = FALSE, progress = FALSE) |>
  dplyr::filter(site_id %in% sites$site_id, variable == "temperature") |>
  dplyr::select(site_id, datetime, variable, observation)

# Standard ending -------------------------------------------------------------
observations |>
  format_targets(cfg, duration = "P1D") |>  # standard columns and types
  check_targets(cfg, "Lakes") |>            # stops if rows, sites or variables went missing
  write_targets(cfg, "Lakes")               # uploads to the group's targets_file
