import { useQuery } from "@tanstack/react-query";
import {
  getOffer,
  listOffers,
  type CommercialOfferFull,
  type OfferGateway,
  type OfferStatus,
} from "@/services/offers";

export function useOffers(filter?: {
  variationId?: string;
  status?: OfferStatus | "all";
  gateway?: OfferGateway | "all";
  search?: string;
}) {
  return useQuery<CommercialOfferFull[]>({
    queryKey: [
      "offers",
      "list",
      filter?.variationId ?? null,
      filter?.status ?? "all",
      filter?.gateway ?? "all",
      filter?.search ?? "",
    ],
    queryFn: () => listOffers(filter),
  });
}

export function useOffer(id: string | null) {
  return useQuery<CommercialOfferFull | null>({
    queryKey: ["offers", "detail", id],
    queryFn: () => (id ? getOffer(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}
