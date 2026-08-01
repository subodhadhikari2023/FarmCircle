export type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  // Restricts which tabs Checkout shows. Omit a method (or set '0') to hide
  // it. Without this, Checkout shows every method regardless of what the
  // buyer picked on our own form.
  method?: {
    netbanking?: "0" | "1";
    card?: "0" | "1";
    upi?: "0" | "1";
    wallet?: "0" | "1";
  };
  handler: (response: RazorpayCheckoutResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayCheckoutInstance = {
  open: () => void;
};

declare global {
  interface Window {
    Razorpay: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance;
  }
}
