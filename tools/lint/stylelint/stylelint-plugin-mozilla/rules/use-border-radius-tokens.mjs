/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-env node */
import stylelint from "stylelint";
import { namespace } from "../helpers.mjs";
import { tokenTables } from "../../../../../toolkit/themes/shared/design-system/token-tables.mjs";

const {
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

let ruleName = namespace("use-border-radius-tokens");

let messages = ruleMessages(ruleName, {
  rejected: value =>
    `${value} should be using a border-radius design token. This may be fixable by running the same command again with --fix.`,
});

let meta = {
  url: "https://firefox-source-docs.mozilla.org/code-quality/lint/linters/stylelint-plugin-mozilla/rules/use-border-radius-tokens.html",
  fixable: true,
};

let tableData = tokenTables["border-radius"];
let tokenMaps = Object.values(tableData).reduce(
  (acc, item) => {
    let tokenVar = `var(${item.name})`;
    acc.valueToTokenVariable[item.value] = tokenVar;
    acc.tokenVariableToValue[tokenVar] = item.value;
    return acc;
  },
  {
    valueToTokenVariable: {
      "50%": "var(--border-radius-circle)",
      "100%": "var(--border-radius-circle)",
      "1000px": "var(--border-radius-circle)",
    },
    tokenVariableToValue: {},
  }
);

let { valueToTokenVariable, tokenVariableToValue } = tokenMaps;
let varRegex = /var\(\s*(?<variable>--[^)]+)\s*\)/;

let isToken = val => !!tokenVariableToValue[val];
let isShorthandVal = val => /\s+/.test(val.trim());

const ALLOW_LIST = ["0", "initial", "unset", "inherit"];

let ruleFunction = primaryOption => {
  return (root, result) => {
    let validOptions = validateOptions(result, ruleName, {
      actual: primaryOption,
      possible: [true],
    });

    if (!validOptions) {
      return;
    }

    let localCssVars = {};

    const isValidVariable = val => {
      const cssVar = val.match(varRegex)?.groups?.variable;
      let resolvedValue = localCssVars[cssVar];
      if (isToken(resolvedValue)) {
        return true;
      }
      return false;
    };

    const isValidShorthand = val => {
      let parts = val.trim().split(/\s+/);
      return parts.every(isValidValue);
    };

    const isValidValue = val => {
      if (isToken(val) || ALLOW_LIST.includes(val)) {
        return true;
      }
      if (val.startsWith("var") && isValidVariable(val)) {
        return true;
      }
      return false;
    };

    // Walk declarations once to generate a lookup table of variables.
    root.walkDecls(decl => {
      if (decl.prop.startsWith("--")) {
        localCssVars[decl.prop] = decl.value;
      }
    });

    // Walk declarations again to detect non-token values.
    root.walkDecls("border-radius", decl => {
      // Check if it's using a token, an allowed value, or a variable defined in
      // the same file that maps back to a token.
      if (isValidValue(decl.value)) {
        return;
      }

      // If the declaration uses a shorthand value e.g. 0 0 2px 4px
      // check whether or not each part of the value is valid.
      if (isShorthandVal(decl.value) && isValidShorthand(decl.value)) {
        return;
      }

      report({
        message: messages.rejected(decl.value),
        node: decl,
        result,
        ruleName,
        fix: () => {
          if (isShorthandVal(decl.value)) {
            let fixedVal = decl.value
              .trim()
              .split(/\s+/)
              .map(part => {
                let token = valueToTokenVariable[part];
                return token ?? part;
              })
              .join(" ");

            if (isValidShorthand(fixedVal)) {
              decl.value = fixedVal;
            }
          }
          let token = valueToTokenVariable[decl.value];
          if (token) {
            decl.value = token;
          }
        },
      });
    });
  };
};
ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = meta;
export default ruleFunction;
