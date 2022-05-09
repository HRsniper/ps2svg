# How to Contribute

We're still working on making contributing to this project as easy and transparent as possible, but we're not quite there yet. We hope this document makes the contribution process clear and answers some questions you may have.

## Code of Conduct

[Code of Conduct](./CODE_OF_CONDUCT.md) that we expect project participants to adhere to.

## Workflow and Pull Requests

When you request a pull request, we'll need someone else to sign the changes and then merge the pull request. We'll do our best to provide updates and feedback throughout the process:

1. Fork the repository and create your branch from `main`:

   ```sh
   $ git clone https://github.com/HRsniper/ps2svg.git
   $ cd ps2svg
   $ git checkout -b my_branch
   ```

2. we use `NPM` to run development scripts:

   ```sh
   $ npm --version
   ```

3. Make sure you have a compatible version of `node` installed ([LTS versions recommended](https://nodejs.org/en/)).

   ```sh
   $ node --version
   ```

4. Install the dependencies:

   ```sh
   $ npm install
   ```

5. Run the application:

   ```sh
   $ npm run start input_ps_file
   ```

## Testing

Tests haven't been written yet. The code needs to be tested to ensure it achieves the desired behavior. The tests fall under either a unit test or an integration test.

- **Unit tests**: If the scope of your work only requires a unit test, you will write it in `test/unit`.

- **Integration tests**: There will be situations, however, where the work you've done cannot be tested alone using unit tests. In situations like this, you should write an integration test. Integration tests reside in the `test/integration` directory.

## License

By contributing, you agree that your contributions will be licensed under this [license](./LICENSE).
