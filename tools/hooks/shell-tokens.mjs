export const SEPARATORS = new Set([';', '&&', '||', '|']);

const SEPARATOR_TEXT = ['&&', '||', ';', '|'];

export function tokenize(command) {
  const tokens = [];
  let index = 0;
  const length = command.length;

  while (index < length) {
    while (index < length && /\s/.test(command[index])) index++;
    if (index >= length) break;

    const start = index;
    const separator = separatorAt(command, index);

    if (separator !== undefined) {
      index += separator.length;
      tokens.push({ value: separator, start, end: index, separator: true });
      continue;
    }

    let value = '';
    while (
      index < length &&
      !/\s/.test(command[index]) &&
      separatorAt(command, index) === undefined
    ) {
      const character = command[index];
      if (character === '"' || character === "'") {
        index++;
        while (index < length && command[index] !== character) {
          value += command[index];
          index++;
        }
        index++;
      } else {
        value += character;
        index++;
      }
    }
    tokens.push({ value, start, end: index, separator: false });
  }

  return tokens;
}

export function findSequence(tokens, words, from = 0) {
  for (let index = from; index + words.length <= tokens.length; index++) {
    if (words.every((word, offset) => isWord(tokens[index + offset], word))) {
      return index;
    }
  }
  return -1;
}

export function isWord(token, word) {
  return token !== undefined && !token.separator && token.value === word;
}

export function statementEnd(tokens, fromIndex) {
  let end = tokens[fromIndex].end;
  for (let index = fromIndex; index < tokens.length && !tokens[index].separator; index++) {
    end = tokens[index].end;
  }
  return end;
}

function separatorAt(command, index) {
  return SEPARATOR_TEXT.find((text) => command.startsWith(text, index));
}
