import { Schema } from "effect";
import { InvoiceId, Value } from "./Projects";

export const PredictionId = Schema.String.pipe(Schema.brand("PredictionId"));
export type PredictionId = typeof PredictionId.Type;

/**
 * Represents a Prediction.
 */
export class Prediction extends Schema.Class<Prediction>("Prediction")({
  id: PredictionId,
  invoiceId: InvoiceId,
  value: Value,
  date: Schema.DateFromString,
}) {
  static readonly create = (
    invoiceId: string,
    value: number,
    date: Date,
    id?: string,
  ) =>
    new Prediction({
      invoiceId: InvoiceId.make(invoiceId),
      date,
      value: Value.make(value),
      id: PredictionId.make(id ?? crypto.randomUUID()),
    });
}

export class Transaction extends Schema.Class<Transaction>("Transaction")({
  transactions: Schema.NonEmptyTrimmedString,
}) {}

export class SimulationPlan extends Schema.Class<SimulationPlan>(
  "SimulationPlan",
)({
  transactions: Schema.Array(Transaction),
}) {}

export const SimulationId = Schema.String.pipe(Schema.brand("SimulationId"));

export class Simulation extends Schema.Class<Simulation>("Simulation")({
  id: SimulationId,
  plan: SimulationPlan,
  predictions: Schema.optional(Schema.Array(Prediction)),
}) {
  static readonly run = (
    invoiceId: string,
    value: number,
    date: Date,
    id?: string,
  ) =>
    new Prediction({
      invoiceId: InvoiceId.make(invoiceId),
      date,
      value: Value.make(value),
      id: PredictionId.make(id ?? crypto.randomUUID()),
    });
}
