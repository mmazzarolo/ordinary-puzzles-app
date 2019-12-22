# Contributing to Ordinary Puzzles

PRs are welcome. When submitting a PR, please consider the following:

- We require tests and will most likely reject a PR if there are no tests.

- We are using [TypeScript](https://www.typescriptlang.org/index.html) and all development should be done in TypeScript.

- This project uses [ESLint](https://eslint.org) for linting and [Prettier](https://prettier.io/) for formatting. See more below.

## Running Ordinary Puzzles

1. Setup the project by running `yarn install`.
2. Disable the Averta font by setting `_useAvertaFont` to `false` in [`src/op-config/constants.ts`](./src/op-config/constants.ts).
3. Run `yarn ios` to run the app on iOS or `yarn android` to run the app on Android.

That's it! 🎉

## Testing

Ordinary Puzzles is being tested with [Jest](https://jestjs.io/docs/en/tutorial-react).  
For running the tests, run `yarn test:watch` to test as you develop, or `yarn test` for a single run.

## Linting

This project uses [ESLint](https://eslint.org) with a [simple preset of rules used by Create-React-App](https://github.com/mmazzarolo/eslint-plugin-react-app).  
This ESLint setup also includes a standard [Prettier](https://prettier.io/) configuration that handles the code formatting.  
The code is automatically formatted before each commit (see the `lint-staged` section in the `package.json` for more details).  
We suggest to enable the formatting on save feature of your editor of choice. If you use VSCode it will be already enabled by default while working on this project (see the [`.vscode`](../.vscode) directory included in the project).  
To manually invoke the linter you can run `yarn lint`.
