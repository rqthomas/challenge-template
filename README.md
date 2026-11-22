# Forecasting challenge template

A minimal, working forecasting challenge built on the
[challenge-ci](https://github.com/eco4cast/challenge-ci) engine. Use it to start
a new challenge: press **Use this template**, name the new repository
`<project_id>-challenge`, and follow the engine's
[launch guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/launching-a-new-challenge.md).

The example challenge forecasts daily water temperature at two reservoirs, using the
Virginia Reservoirs LTREB's public data from the
[VERA Forecasting Challenge](https://www.ltreb-reservoirs.org/vera4cast/) (one target
group, `Lakes`).

```
challenge_configuration.yaml   every setting; values marked CHANGE are yours to set
sites.csv                      the sites, and which target group each is in
challenge/targets/             one targets script per target group
registry/forecast_repos.csv    the participants' git repositories the CI reads forecasts from
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
then from this folder run every stage as a dry run. Dry runs write only to
`DRY_RUN_DIR`. They read the real data, and as the bucket is private they read it
with the key, so export `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` first (see
*Set up a free Backblaze B2 private bucket*; the key can be read-only for a dry run):

```sh
export DRY_RUN=true DRY_RUN_DIR=$PWD/dry-run
Rscript -e 'challengeci::run_stage()' check
Rscript challenge/targets/lakes_targets.R
Rscript -e 'challengeci::run_stage()' baselines daily
Rscript -e 'challengeci::run_stage()' bundle forecasts
Rscript -e 'challengeci::run_stage()' score
Rscript -e 'challengeci::run_stage()' catalog
Rscript -e 'challengeci::run_stage()' dashboard site   # then: python3 -m http.server -d site
```

Later stages read the targets the targets script wrote to `DRY_RUN_DIR`, so
the whole pipeline runs before anything is published. The dashboard's pages load
their data with `fetch`, which browsers block for files opened directly, so serve
`site/` (the command above) and open <http://localhost:8000>.

## How participants submit

Participants keep a **public git repository** (GitHub, GitLab, Bitbucket or
Codeberg); the `submissions` stage reads new forecast files from every
repository listed in `registry/forecast_repos.csv`. There is no submissions
bucket and no key to hand out. A participant

1. adds `challenge-model.yaml` at the repository root. It names the challenge
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

2. commits forecasts to `forecasts/` as `.csv` or `.csv.gz` files. **File names
   are free**: a forecast is identified by its `model_id` and `reference_datetime`
   columns, one file can hold several variables, and one file can serve several
   challenges (each keeps only the rows with its own variables, durations and
   sites). Every row needs `duration` as well as `site_id` and `variable`;
3. opens the **Register a model repository** issue form (it is in
   `.github/ISSUE_TEMPLATE/`) with the repository's address and where the
   forecasts go. The `register-forecast-repo` workflow checks the repository, adds
   a row to `registry/forecast_repos.csv`, replies on the issue and closes it. A
   model id already registered through the form is held for you to confirm
   (label `needs-review`: check the repository is its owner's, then add the row
   yourself). You can also add rows by hand (`repo,location,registered`, with
   `repo` as `owner/name` for GitHub or `https://gitlab.com/owner/name`).

What happened to each file, with the reason for any rejection and how many rows
were kept, is published to `<forecasts_bucket>/submission_results/<model_id>.csv`.
The challenge's own baseline models are written straight to the forecasts bucket
(`submissions$baselines_destination`), so the CI needs only the main store's key.
To accept uploads to a bucket as well, see the comments under `submissions:` in
the config (a model's registry `location` is then `bucket`, and
`submissions$bucket$strict_from` sets the date old-format files stop being
accepted). The details are in the engine's
[operations guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/operations.md#submissions-from-git-repositories).

This needs an engine release with git-repository submissions: set the version after `@`
in `.github/workflows/*.yaml` to one that has it.

As shipped, the config points at the Backblaze B2 bucket `template-challenge`
under `project_id: templatecast`; dry runs read it without writing to it. Keep the
workflows' schedules commented out until the steps in *Going live* are done.

## Set up a free Backblaze B2 private bucket

A challenge keeps its targets, forecasts, scores and catalog data in one S3 bucket.
[Backblaze B2](https://www.backblaze.com/cloud-storage) speaks the S3 API, and its
free tier is enough for a small challenge: **the first 10 GB of storage is free**, and
so are downloads up to three times the data you store each month (more is billed at
about $0.01 per GB; see Backblaze's
[pricing page](https://www.backblaze.com/cloud-storage/pricing) for the current terms).
This template, with two sites, stays far below that. The bucket is **private**: only
holders of a key can read or write it. Your dashboard stays public, because the CI
reads the bucket with its key and publishes small files to the site (see the engine's
`docs/dashboard-data.md`).

1. **Create a Backblaze account.** Go to <https://www.backblaze.com/cloud-storage>, choose
   *Sign Up*, and verify your email. Sign in to the web console and open
   **B2 Cloud Storage**.
2. **Create the bucket.** Open **Buckets → Create a Bucket** and set:
   - *Bucket Unique Name*: a name nobody else has used, for example
     `<project_id>-challenge` (letters, numbers and hyphens). Backblaze tells you if it is taken.
   - *Files in Bucket are*: **Private**.
   - *Default Encryption*: leave the default.
   - *Object Lock*: **off**. The CI overwrites and deletes files, and Object Lock can block that.

   Create it and copy the **Endpoint** shown for the bucket, for example
   `s3.us-east-005.backblazeb2.com`. The part after `s3.` is the region
   (`us-east-005`); the engine reads it from the endpoint.
3. **Keep only the newest version of each file.** Open the bucket's **Lifecycle
   Settings** and choose **Keep only the last version of the file**. By default B2 keeps
   every version of every file you overwrite, forever, and the CI overwrites the targets,
   the catalog and its bookkeeping files on every run, so storage would grow until it
   passes the free 10 GB.
4. **Create the key the CI uses.** Open **Application Keys → Add a New Application Key**.
   Name it (for example `<project_id>-ci`), set *Allow access to Bucket(s)* to your bucket,
   *Type of Access* to **Read and Write**, and leave *File name prefix* empty. Create it
   and **copy the keyID and the applicationKey now**: the applicationKey is shown once.
   They become the GitHub secrets `S3_ACCESS_KEY_ID` (the keyID) and
   `S3_SECRET_ACCESS_KEY` (the applicationKey); see *Secrets and tokens*.
5. **Create a read-only key for participants.** Add a second application key, this
   time with *Type of Access* **Read Only** and the same bucket. Participants read the
   targets with it (the example submission takes it as `S3_KEY` and `S3_SECRET`) and
   cannot change anything. Anyone who has it can read the bucket, so share it only with
   participants; if it leaks, delete it in the console and create another. Set
   `dashboard: key_request_url` in the config to where people should ask for it (an issue
   form, a web form or a `mailto:` link); the dashboard's Participate and Data pages then
   send them there. Without it they are told to email `dashboard: contact_email`.
6. **Point the config at your bucket.** Every place that names the bucket, endpoint or
   project is in `challenge_configuration.yaml` and marked `CHANGE`. To change the bucket
   name and the endpoint everywhere at once:
   ```sh
   sed -i.bak 's/template-challenge/<your-bucket>/g; s/s3\.us-east-005\.backblazeb2\.com/<your-endpoint>/g' challenge_configuration.yaml
   ```
   Then replace the project id `templatecast` (the `project_id` key and the
   `project_id=templatecast` in each group's `targets_file`) with yours. Keep
   `public_read: false`, so the CI reads with the key. Delete the `.bak` file when the
   config looks right.
7. **Test the key and the bucket.** With the CI key from step 4:
   ```sh
   export S3_ACCESS_KEY_ID=<keyID> S3_SECRET_ACCESS_KEY=<applicationKey>
   Rscript -e 'library(challengeci); cfg <- read_config(); remote_connect(cfg, "main"); print(remote_files(bucket_uri(cfg, "forecasts_bucket", scheme = "remote")))'
   ```
   An empty bucket prints `character(0)`; a wrong key, endpoint or bucket name stops with
   an error. Then confirm that anonymous readers are refused (upload any file first, for
   example in the console, and use its name):
   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' https://<your-endpoint>/<your-bucket>/<file>
   ```
   Any code except `200` means the bucket is private.

*Watch the free allowance.* In the console, **Buckets** shows each bucket's size and
your account's usage page shows downloads; B2 also lets you set usage caps and alerts in
the account settings (look for *Caps & Alerts*), which stop a runaway job from billing
you. Each participant read of the data counts as a download.

*Using a public bucket instead.* Set the bucket's files to *Public* and `public_read: true`.
Then anyone can read single files by their address and no key is needed, but I believe B2
does not answer an anonymous request to *list* a bucket, which anything that opens a
folder of parquet files without a key (the catalog's access code, participants using
`arrow::open_dataset()`) needs. If you want to go that way, check with
`curl -s 'https://<your-endpoint>/<your-bucket>/?list-type=2&max-keys=1'` first.

## Secrets and tokens

All of these are **repository secrets** of this repository: on github.com open
**Settings → Secrets and variables → Actions → New repository secret**, or run
`gh secret set <NAME> -R <owner>/challenge-template` and paste the value. A secret
cannot be read back, so keep the original in a password manager. Never put a key in
the config, a workflow or the code.

| Secret | Needed for | What it is |
|---|---|---|
| `S3_ACCESS_KEY_ID` | every workflow that reads or writes the bucket: targets, baselines, submissions, bundling, scoring, catalog, dashboard | The Backblaze B2 **application key ID**. The name is the same for any S3 store. |
| `S3_SECRET_ACCESS_KEY` | the same | The B2 **application key** that goes with it. |
| `WORKFLOW_TOKEN` | the *update-engine* workflow | A GitHub fine-grained token for **this repository** with *Contents*, *Pull requests* and *Workflows* set to *Read and write*. |

*The B2 key* is step 4 of *Set up a free Backblaze B2 private bucket*, above: a key for
your bucket with *Read and Write* access. B2 shows the keyID (→ `S3_ACCESS_KEY_ID`) and
the applicationKey (→ `S3_SECRET_ACCESS_KEY`) only once. Scoring's scratch space is
`<bucket>/tmp` and uses the same key (`credentials` in the config).

*A GitHub fine-grained token.* On github.com click your profile picture →
**Settings → Developer settings → Personal access tokens → Fine-grained tokens →
Generate new token**. Name it, set *Resource owner* to the account that owns the
repository, choose an *Expiration* (renew it then), pick **Only select
repositories** and the repository from the table, set the permissions from the table
to *Read and write*, generate it and copy it straight away (GitHub shows it once). An
organization may need to approve fine-grained tokens first.

*Not needed here:* `CATALOG_TOKEN` (the catalog is a branch of this repository, pushed with the
built-in token), `EFI_NRP_KEY`/`EFI_NRP_SECRET` (scratch uses the B2 key),
`AWS_ACCESS_KEY_SUBMISSIONS`/`AWS_SECRET_ACCESS_KEY_SUBMISSIONS` (there is no
submissions bucket), `NEON_TOKEN` (the water temperature targets come from VERA's public file) and the
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
- **Participants** need no token to submit from GitHub. The bucket is private, so give
  them the **read-only** B2 key (step 5 above) to read the targets; the example
  submission reads it from its `S3_KEY` and `S3_SECRET` secrets.

The engine's [launch guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/launching-a-new-challenge.md#5-add-the-secrets-and-tokens)
has the full list of secrets for challenges that do more (a submissions bucket, NEON
targets, their own image).

## Going live

The config stores everything in one private Backblaze B2 bucket, `template-challenge`,
through the S3 endpoint `s3.us-east-005.backblazeb2.com`; for your own challenge use the bucket you
create in *Set up a free Backblaze B2 private bucket*. What is left to do is on B2 and
GitHub:

1. **Create the private bucket and its two keys** (*Set up a free Backblaze B2 private
   bucket*, steps 1 to 5), and put its name and endpoint in the config (step 6).
2. **Decide how participants get the read-only key**, and set
   `dashboard: key_request_url` in the config to match.
3. **Check access** (step 7 of the same section): the CI key can list the bucket, and an
   anonymous request for a file is refused.
4. **Add the GitHub secrets** listed in *Secrets and tokens* below.
5. **Point the workflows at an engine release that has GitHub submissions**
   (the version after `@` in `.github/workflows/*.yaml`).
6. **Run each workflow once by hand** with *Dry run* ticked, then again with it
   unticked, in this order: targets, baselines, submissions, bundling, scoring,
   catalog, dashboard. Then uncomment the schedules.
7. **Nothing to create for the catalog.** It is committed to the `catalog` branch of
   this repository (`catalog_config: catalog_branch`): the first *catalog* run creates
   the branch, empty apart from the catalog, and the built-in token pushes to it (the
   workflow has `permissions: contents: write`), so there is no catalog repository and
   no `CATALOG_TOKEN`. The repository must be public, since STAC Browser and the
   catalog's links read the files from `raw.githubusercontent.com`. For a very large
   catalog, give it a repository of its own instead (the engine's
   [launch guide](https://github.com/eco4cast/challenge-ci/blob/main/docs/launching-a-new-challenge.md#the-catalog)
   describes both).
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
