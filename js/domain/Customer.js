/**
 * Customer entity matching Section 11 Class Diagram.
 */
export class Customer {
  #customerId;
  #fullName;

  constructor(customerId, fullName) {
    if (!fullName || !fullName.trim()) {
      throw new Error("Customer full name is required.");
    }
    this.#customerId = customerId;
    this.#fullName = fullName.trim();
  }

  getCustomerId() {
    return this.#customerId;
  }

  getFullName() {
    return this.#fullName;
  }
}
