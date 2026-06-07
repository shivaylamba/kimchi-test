/**
 * A simple calculator utility.
 *
 * NOTE: There is an intentional off-by-one bug in the `add` method
 * for demonstration purposes. The self-healing CI pipeline should
 * detect and fix it automatically.
 */

export class Calculator {
  /**
   * Adds two numbers together.
   *
   * BUG: This method currently returns `a + b + 1` instead of `a + b`.
   * This causes the addition test to fail and triggers the self-healing
   * workflow in GitHub Actions.
   */
  add(a: number, b: number): number {
    // Intentional bug for demo purposes
    return a + b + 1;
  }

  /**
   * Subtracts the second number from the first.
   */
  subtract(a: number, b: number): number {
    return a - b;
  }

  /**
   * Multiplies two numbers together.
   */
  multiply(a: number, b: number): number {
    return a * b;
  }

  /**
   * Divides the first number by the second.
   * Throws an error if dividing by zero.
   */
  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    return a / b;
  }
}
