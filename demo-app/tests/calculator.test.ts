import { Calculator } from '../src/calculator';

describe('Calculator', () => {
  let calc: Calculator;

  beforeEach(() => {
    calc = new Calculator();
  });

  /**
   * This test is EXPECTED TO FAIL due to the intentional off-by-one
   * bug in calculator.ts. It demonstrates the self-healing pipeline
   * detecting and fixing a real regression.
   */
  test('adds two numbers correctly', () => {
    expect(calc.add(2, 3)).toBe(5);
  });

  test('subtracts two numbers correctly', () => {
    expect(calc.subtract(5, 3)).toBe(2);
  });

  test('multiplies two numbers correctly', () => {
    expect(calc.multiply(4, 3)).toBe(12);
  });

  test('divides two numbers correctly', () => {
    expect(calc.divide(10, 2)).toBe(5);
  });

  test('throws when dividing by zero', () => {
    expect(() => calc.divide(10, 0)).toThrow('Division by zero is not allowed');
  });
});
