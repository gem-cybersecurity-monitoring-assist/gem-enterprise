import type { Metadata } from "next";
import { PersonnelLiveManager } from "@/components/admin/PersonnelLiveManager";

export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Live People & Teams Management | GEM Enterprise",
  description:"Authenticated GEM Enterprise website editorial and personnel publishing management.",
  robots:{index:false,follow:false,nocache:true},
};

export default function AdminPersonnelLivePage(){return <PersonnelLiveManager/>;}
