"use server";
import { sql } from "@vercel/postgres";
import { signIn } from "@auth";
import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";

export type State = {
  error?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a Customer.",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please Enter amount greater than $0" }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an Invoice Status.",
  }),
  date: z.string(),
});

const CreateInvoice = InvoiceSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
  const validateFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  //*Checking for correct validation
  console.log(validateFields);
  if (!validateFields.success) {
    return {
      error: validateFields.error.flatten().fieldErrors,
      message: "Missing Field. Failed to create Invoice.",
    };
  }
  const { customerId, amount, status } = validateFields.data;
  const amountInCents = amount * 100; //To eliminate floating-point error
  const date = new Date().toISOString().split("T")[0];
  try {
    await sql`
  INSERT INTO invoices(customer_id, amount, status, date)
  VALUES (${customerId},${amountInCents},${status},${date})
  `;
  } catch (err) {
    return {
      message: "Database Error: Failed to Create Invoice.",
    };
  }

  //*Next.js has a Client-side Router Cache that stores the route segments in the user's browser for a time. Along with prefetching, this cache ensures that users can quickly navigate between routes while reducing the number of requests made to the server.

  //*Since you're updating the data displayed in the invoices route, you want to clear this cache and trigger a new request to the server. You can do this with the revalidatePath function from Next.js:
  revalidatePath("dashboard/invoices");
  redirect("/dashboard/invoices", RedirectType.replace);
}

const UpdateInvoice = InvoiceSchema.omit({ date: true, id: true });

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  const amountInCents = amount * 100; //To eliminate floating-point error
  try {
    await sql`
  UPDATE invoices
  SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
  WHERE id = ${id}
  `;
  } catch (err) {
    return {
      message: "Database Error: Failed to Update Invoice.",
    };
  }

  revalidatePath("dashboard/invoices");
  redirect("/dashboard/invoices", RedirectType.replace);
}

export async function deleteInvoice(id: string | number) {
  //*Simulating an error
  // throw new Error("failed to delete Invoice")
  try {
    await sql`
  DELETE FROM invoices 
  WHERE id = ${id}
  `;
  } catch (err) {
    return {
      message: "Database Error: Failed to Delete Invoice",
    };
  }
  revalidatePath("/dashboard/invoices");
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", Object.fromEntries(formData));
  } catch (err) {
    if ((err as Error).message.includes("CredentialsSignin")) {
      return "CredentialsSignin";
    }
    throw err;
  }
}
