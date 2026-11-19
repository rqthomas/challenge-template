# Forecasting challenge template

A minimal, working forecasting challenge built on the
[challenge-ci](https://github.com/eco4cast/challenge-ci) engine. Use it to start
a new challenge: press **Use this template**, name the new repository
`<project_id>-challenge`, and follow the engine's
[launch guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/launching-a-new-challenge.md).

The example challenge forecasts daily surface water temperature at three lakes
(one target group, `Lakes`).

```
challenge_configuration.yaml   every setting; values marked CHANGE are yours to set
sites.csv                      the sites, and which target group each is in
challenge/targets/             one targets script per target group
challenge/dashboard/           dashboard text (anything left out uses the engine's default)
.github/workflows/             triggers that run the engine's workflows
```

Engine updates arrive by changing the version after `@` in
`.github/workflows/*.yaml`; nothing in this repository needs merging.

## Try it

Install the engine (or use its Docker image, `ghcr.io/eco4cast/challenge-ci`),
then from this folder run every stage as a dry run. Dry runs read the real,
public data but write only to `DRY_RUN_DIR`:

```sh
export DRY_RUN=true DRY_RUN_DIR=$PWD/dry-run
Rscript -e 'challengeci::run_stage()' check
Rscript challenge/targets/lakes_targets.R
Rscript -e 'challengeci::run_stage()' baselines daily
Rscript -e 'challengeci::run_stage()' bundle forecasts
Rscript -e 'challengeci::run_stage()' score
Rscript -e 'challengeci::run_stage()' catalog
Rscript -e 'challengeci::run_stage()' dashboard site   # then open site/index.html
```

Later stages read the targets the targets script wrote to `DRY_RUN_DIR`, so
the whole pipeline runs before anything is published. The `submissions` stage
also needs the submissions store's key in `.Renviron` (never committed).

As shipped, the config points at the Ecological Forecasting Initiative's
public store under `project_id: templatecast`. **Change the values marked
CHANGE before any real run**, and keep the workflows' schedules commented out
until then.
