# GitHub-App-Token

A tool to request a new access token from an installed GitHub Application.

## Prerequisites

Create a custom GitHub Application by going to your account or organization settings -> `Developer Settings` -> `GitHub Apps` and
click on the `New GitHub App` button

1. Enter the application name, homepage and other required basic information. Disable WebHooks if not needed.
2. Configure the permissions this application will have and where can be installed.
3. Take note of the generate `Application ID`.
4. Once the application has been created install it on your organization or personal account. If you omit this step, you can install
later by editing the application on the `GitHub Apps` settings page.

Generate a private key:

1. Go back to your account or organization settings -> `Developer Settings` -> `GitHub Apps` and click on the `Edit` button of your
newly created application.
2. Scroll down in the General settings and look for the `Generate a private key` button.
3. Save the newly private key in a **SECURE** location like a GitHub secret.

## Usage

Make sure you have [NodeJS](https://nodejs.org/en/download) installed as well as the latest version of the
[`npm`](https://www.npmjs.com/package/npm) package.

Run `npx [-y] @c3exchange/github-app-token@latest {parameters}`

Where `parameters` can be:

| Parameter                       | Description                                                                                                                                                   |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--pk {private-key-file}`       | A file containing the generated RSA-256 private key. If `private-key-file` is equal to `stdin`, the script will read the private key from the standard input. |
| `--app-id {application-id}`     | Specifies the application ID.                                                                                                                                 |
| `--inst-id {installation-id}`   | Specifies the installation ID. This parameter is optional.                                                                                                    |
| `--org {organization-name}`     | Restricts the lookup of the installation ID to the given organization.                                                                                        |
| `--user {user-name}`            | Restricts the lookup of the installation ID to the given user.                                                                                                |
| `--perm {list-of-permissions}`  | A list of requested permissions separated by comma. See below for details.                                                                                    |
| `--scope {list-of-permissions}` | Alias of `--perm`.                                                                                                                                            |
| `--ua {user-agent}`             | An  user agent to use in web requests. Defaults to: `GitHubAppToken-Retriever/1.0`.                                                                           |

##### NOTE

* Use `-y` flag on automated environments like deployment ones to avoid undesired prompts.

### Permissions

Each permission consist in strings with the following format: `access:type`

Type can be: `contents`, `packages`, `secrets`, etc. See [GitHub documentation](https://docs.github.com/en/rest/apps/apps?apiVersion=2022-11-28#create-an-installation-access-token-for-an-app) for a complete list of access types.

`access` is optional and must be separated from the type with a `:` (colon). If specified, it must be `read`, `write` or `admin`.
 Defaults to `read`.

Some examples:

* `write:contents` allows write access to repository contents.
* `packages` allows read access to packages.
* `read:secrets` allows read access to secrets in a GitHub action.

# License

Apache 2.0
