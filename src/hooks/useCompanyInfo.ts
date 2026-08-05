import { useQuery } from "@tanstack/react-query";
import { fetchCompanyInfo, fetchCompanyInfoFull, isCompanyComplete, type CompanyInfo } from "@/lib/doc-branding";

/** Informations légales publiques (documents côté client/convoyeur). */
export function useCompanyInfo() {
  const query = useQuery<CompanyInfo | null>({
    queryKey: ["company-info"],
    queryFn: fetchCompanyInfo,
    staleTime: 5 * 60 * 1000,
  });
  return { ...query, complete: isCompanyComplete(query.data) };
}

/** Informations complètes incluant IBAN/BIC (admin). */
export function useCompanyInfoFull() {
  const query = useQuery<CompanyInfo | null>({
    queryKey: ["company-info-full"],
    queryFn: fetchCompanyInfoFull,
    staleTime: 60 * 1000,
  });
  return { ...query, complete: isCompanyComplete(query.data) };
}
