# Lakes targets: daily mean water temperature at two reservoirs.
#
# An example of a targets script. Its data come from a public file, the in situ
# targets of the VERA Forecasting Challenge (Virginia Reservoirs LTREB,
# https://www.ltreb-reservoirs.org/vera4cast/), so it runs without any keys.
# Replace the "Download and clean" section with your own data source; keep the
# last three steps, which every targets script ends with.
#
# Run from the repository root:  Rscript challenge/targets/lakes_targets.R
#
# Environment variables
#   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY  main store, for the upload
#   DRY_RUN=true         write the targets to a local folder instead

library(challengeci)

cfg <- read_config()
sites <- read_sites(cfg, "Lakes")

# Download and clean ----------------------------------------------------------
# Any code that ends with one row per site, datetime and variable, with an
# `observation` column. Datetimes are in UTC; NA observations are allowed.
source_url <- paste0("https://amnh1.osn.mghpcc.org/bio230121-bucket01/vera4cast/targets/",
                     "project_id=vera4cast/duration=P1D/daily-insitu-targets.csv.gz")

# VERA measures temperature at many depths (a `depth_m` column), but this
# challenge's format has one series per site. So each reservoir's series is the
# sensor VERA forecasts at, 1.6 m in Falling Creek Reservoir (fcre) and 1.5 m in
# Beaverdam Reservoir (bvre), and the variable is called `temperature`.
focal_depth_m <- c(fcre = 1.6, bvre = 1.5)

observations <- readr::read_csv(source_url, show_col_types = FALSE, progress = FALSE) |>
  dplyr::filter(
    variable == "Temp_C_mean",
    site_id %in% sites$site_id,
    dplyr::near(depth_m, unname(focal_depth_m[site_id]))
  ) |>
  dplyr::mutate(variable = "temperature") |>
  # The file starts each series before its sensor was installed: begin at the
  # first observation.
  dplyr::filter(datetime >= min(datetime[!is.na(observation)]), .by = site_id) |>
  dplyr::select(site_id, datetime, variable, observation)

# Standard ending -------------------------------------------------------------
observations |>
  format_targets(cfg, duration = "P1D") |>  # standard columns and types
  check_targets(cfg, "Lakes") |>            # stops if rows, sites or variables went missing
  write_targets(cfg, "Lakes")               # uploads to the group's targets_file
