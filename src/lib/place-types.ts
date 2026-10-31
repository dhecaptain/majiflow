/**
 * The shape of a place result.
 *
 * Lives outside the API route so the server route and the browser helper share
 * one definition without either side importing the other.
 */

export type PlaceKind = "estate" | "street" | "area" | "city" | "place";

export interface PlaceResult {
  id: string;
  /** Short name a customer would recognise, e.g. "Kibera". */
  label: string;
  /** The wider context, e.g. "Nairobi County, Kenya". */
  sublabel?: string;
  lat: number;
  lng: number;
  kind: PlaceKind;
}
