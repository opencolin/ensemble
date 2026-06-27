// Password validator. Correct but intentionally messy — refactor without
// changing behavior. The acceptance test pins the exact messages and order.

export function validatePassword(pw) {
  let errors = [];
  if (pw === undefined || pw === null || pw === "") {
    errors.push("password is required");
    return errors;
  } else {
    if (pw.length < 8) {
      errors.push("must be at least 8 characters");
    } else {
      // length ok
    }
    let hasUpper = false;
    for (let i = 0; i < pw.length; i++) {
      let ch = pw[i];
      if (ch >= "A" && ch <= "Z") {
        hasUpper = true;
      }
    }
    if (hasUpper === false) {
      errors.push("must contain an uppercase letter");
    }
    let hasLower = false;
    for (let i = 0; i < pw.length; i++) {
      let ch = pw[i];
      if (ch >= "a" && ch <= "z") {
        hasLower = true;
      }
    }
    if (!hasLower) {
      errors.push("must contain a lowercase letter");
    }
    let hasDigit = false;
    for (let i = 0; i < pw.length; i++) {
      let ch = pw[i];
      if (ch >= "0" && ch <= "9") {
        hasDigit = true;
      }
    }
    if (hasDigit !== true) {
      errors.push("must contain a digit");
    }
  }
  return errors;
}
