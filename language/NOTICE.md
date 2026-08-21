# Vendored workflow grammars

`syntaxes/yaml.tmLanguage.json`, `syntaxes/expressions.tmGrammar.json` and
`language-configuration.json` are vendored from
[github/vscode-github-actions](https://github.com/github/vscode-github-actions) (MIT), which is what
gives Gitea Actions workflow files their highlighting — Gitea Actions uses the GitHub Actions
workflow syntax.

Only the TextMate **scope name** was changed, `source.github-actions-workflow` →
`source.gitea-actions-workflow`, so the two extensions can coexist. Token names such as
`support.function.github-actions-expression` are deliberately unchanged, so themes that already
style GitHub Actions expressions style ours identically.

```
MIT License

Copyright (c) GitHub

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
