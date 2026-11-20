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
registry/forecast_repos.csv    the participants' GitHub repositories the CI reads forecasts from
.github/ISSUE_TEMPLATE/        the issue form participants use to register a repository
challenge/dashboard/           dashboard text (anything left out uses the engine's default)
.github/workflows/             triggers that run the engine's workflows
```

Engine updates arrive by changing the version after `@` in
`.github/workflows/*.yaml`; nothing in this repository needs merging. The
**update-engine** workflow does it for you: run it from the Actions tab with a version
(or none, for the latest stable release) and it opens a pull request that moves every
workflow. It needs a repository secret `WORKFLOW_TOKEN`; the engine's
[operations guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/operations.md#upgrading-the-engine)
shows how to create it.

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
the whole pipeline runs before anything is published.

## How participants submit

Participants keep their forecasts in a **public GitHub repository**; the
`submissions` stage reads new files from every repository listed in
`registry/forecast_repos.csv`. There is no submissions bucket and no key to hand
out. A participant

1. puts forecasts in `forecasts/`, named `<theme>-<YYYY-MM-DD>-<model_id>.csv.gz`
   (here `lakes-2026-01-01-my_model.csv.gz`);
2. adds `challenge-model.yaml` at the repository root. It names the challenge
   and the model, and gives the model's metadata (the questions of the
   registration form, answered the same way); the catalog's model records are
   built from it:

   ```yaml
   challenge: templatecast        # your project_id
   models:
     - model_id: my_model
       path: forecasts/
       long_name: My lake model
       description: A process model of lake temperature
       model_type: process-based
       dynamic: true
   ```

3. opens the **Register a forecast repository** issue form (it is in
   `.github/ISSUE_TEMPLATE/`) with the repository's address. The
   `register-forecast-repo` workflow checks the repository, adds a row to
   `registry/forecast_repos.csv`, replies on the issue and closes it. A model id
   already registered through the form is held for you to confirm
   (label `needs-review`: check the repository is its owner's, then add the row
   yourself). You can also add rows by hand (`repo,repo_id,registered`; get the id
   with `gh api repos/<owner>/<name> --jq .id`).

What happened to each file, with the reason for any rejection, is published to
`<forecasts_bucket>/submission_results/<model_id>.csv`. The challenge's own
baseline models are written straight to the forecasts bucket
(`submissions$baselines_destination`), so the CI needs only the main store's key.
To accept uploads to a bucket as well, see the comments under `submissions:` in
the config. The details are in the engine's
[operations guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/operations.md#submissions-from-github-repositories).

This needs an engine release with GitHub submissions: set the version after `@`
in `.github/workflows/*.yaml` to one that has it.

As shipped, the config points at the Backblaze B2 bucket `template-challenge`
under `project_id: templatecast`; dry runs read it without writing to it. Keep the
workflows' schedules commented out until the steps in *Going live* are done.

## Secrets and tokens

All of these are **repository secrets** of this repository: on github.com open
**Settings → Secrets and variables → Actions → New repository secret**, or run
`gh secret set <NAME> -R <owner>/challenge-template` and paste the value. A secret
cannot be read back, so keep the original in a password manager. Never put a key in
the config, a workflow or the code.

| Secret | Needed for | What it is |
|---|---|---|
| `OSN_KEY` | every workflow that reads or writes the bucket: targets, baselines, submissions, bundling, scoring, catalog, dashboard | The Backblaze B2 **application key ID**. The name is the engine's, whatever the store is. |
| `OSN_SECRET` | the same | The B2 **application key** that goes with it. |
| `WORKFLOW_TOKEN` | the *update-engine* workflow | A GitHub fine-grained token for **this repository** with *Contents*, *Pull requests* and *Workflows* set to *Read and write*. |
| `CATALOG_TOKEN` | the *catalog* workflow | A GitHub fine-grained token for the **catalog repository** only, with *Contents* set to *Read and write*. |

*The B2 key.* In Backblaze open **Application Keys → Add a New Application Key**; name
it, set *Allow access to Bucket(s)* to `template-challenge` and *Type of Access* to
**Read and Write**, and create it. B2 shows the keyID (→ `OSN_KEY`) and the
applicationKey (→ `OSN_SECRET`) only once. Scoring's scratch space is
`template-challenge/tmp` and uses the same key (`credentials` in the config).

*A GitHub fine-grained token.* On github.com click your profile picture →
**Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Generate new token**. Name it, set *Resource owner* to the account that owns the
repository, choose an *Expiration* (renew it then), pick **Only select
repositories** and the repository from the table, set the permissions from the table
to *Read and write*, generate it and copy it straight away (GitHub shows it once). An
organization may need to approve fine-grained tokens first.

*Not needed here:* `EFI_NRP_KEY`/`EFI_NRP_SECRET` (scratch uses the B2 key),
`AWS_ACCESS_KEY_SUBMISSIONS`/`AWS_SECRET_ACCESS_KEY_SUBMISSIONS` (there is no
submissions bucket), `NEON_TOKEN` (the lake targets come from public data) and the
Docker Hub secrets (there is no image of its own).

*Not tokens, but they must be right:*
- **The engine's container image must be public.** Every job runs in
  `ghcr.io/rqthomas/challenge-ci:<version>`; if the package is private the jobs fail at
  "Initialize containers". On github.com open your profile → **Packages →
  `challenge-ci` → Package settings → Change visibility → Public** (the image holds
  nothing secret).
- **Workflow permissions.** The dashboard and registration workflows use the built-in
  token and ask for the permissions they need. If a run fails with a 403, set
  **Settings → Actions → General → Workflow permissions** to *Read and write
  permissions*.
- **Participants** need no token to submit from GitHub. If you make the bucket
  private, give them a **read-only** B2 key (*Type of Access: Read Only*) to read the
  targets; the example submission reads it from its `S3_KEY` and `S3_SECRET` secrets.

The engine's [launch guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/launching-a-new-challenge.md#5-add-the-secrets-and-tokens)
has the full list of secrets for challenges that do more (a submissions bucket, NEON
targets, their own image).

## Going live

The config stores everything in one Backblaze B2 bucket,
`template-challenge`, through the S3 endpoint `s3.us-east-005.backblazeb2.com`.
What is left to do is on B2 and GitHub:

1. **Make the bucket readable without a key.** In B2, set the bucket's files to
   *Public*. The dashboard, the catalog and participants read forecasts, scores and
   targets without credentials.
2. **Create an application key** limited to `template-challenge` with read and
   write access (see *Secrets and tokens*). Keep its key ID and application key.
3. **Check what anonymous readers can do.** Upload any file, then
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' https://s3.us-east-005.backblazeb2.com/template-challenge/<file>
   curl -s 'https://s3.us-east-005.backblazeb2.com/template-challenge/?list-type=2&max-keys=1'
   ```
   The first must print `200`. The second shows whether anonymous *listing* works.
   Reading a folder of parquet files (`arrow::open_dataset()` on the bucket) needs
   listing, so if it is refused, see the note below before announcing the challenge.
   The config sets `public_read: false`, so the engine itself reads with the key and does
   not need anonymous listing; this check is about what *participants* can do.
4. **Add the GitHub secrets** listed in *Secrets and tokens* below.
5. **Point the workflows at an engine release that has GitHub submissions**
   (the version after `@` in `.github/workflows/*.yaml`).
6. **Run each workflow once by hand** with *Dry run* ticked, then again with it
   unticked, in this order: targets, baselines, submissions, bundling, scoring,
   catalog, dashboard. Then uncomment the schedules.
7. **Create the catalog repository** named in `catalog_config` (the engine's
   [launch guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/launching-a-new-challenge.md#the-catalog)
   has the command), and add the `CATALOG_TOKEN` secret.
8. **Set up the dashboard on GitHub Pages** (once). The dashboard workflow pushes the
   built site to a `gh-pages` branch, which must exist first (commit or stash any
   uncommitted changes before this, because the first command empties your working
   folder until you switch back):
   ```sh
   git switch --orphan gh-pages
   touch .nojekyll && git add .nojekyll
   git commit -m "Create gh-pages"
   git push -u origin gh-pages
   git switch main
   ```
   Then, on github.com, open **Settings → Pages**, set **Source** to *Deploy from a
   branch*, **Branch** to `gh-pages`, folder `/ (root)`, and **Save**. The page shows the
   site's address (here `https://rqthomas.github.io/challenge-template/`); put it in
   `challenge_url` in the config. Run the *dashboard* workflow with *Dry run* unticked and
   the site is live within a minute or two. The engine's
   [launch guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/launching-a-new-challenge.md#9-set-up-publishing)
   lists what to do if a step fails.

*Anonymous listing.* B2 serves single files from a public bucket, but I believe it
does not answer an anonymous request to list a bucket. If step 3 shows that, then
anything that opens a *folder* of data without credentials fails against this bucket:
the engine's own anonymous reads (bundling, scoring, the catalog and the dashboard
open the bundled datasets that way) and the access code the catalog gives
participants. Files fetched by their exact URL still work, and the engine's stages
work with credentials. The engine's own reads are solved by `public_read: false`, which makes it read with
the application key (the bucket may then stay private). Participants' access is not:
decide whether to give them a read-only key or direct file links, or to use a store
that allows anonymous listing.
