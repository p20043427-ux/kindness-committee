import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { MOCK_BUILDINGS, MOCK_DEPARTMENTS } from '@/src/lib/data';

export interface Building {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  buildingId: string;
}

interface OrganizationContextType {
  buildings: Building[];
  departments: Department[];
  isLoading: boolean;
  addBuilding: (building: Building) => Promise<void>;
  updateBuilding: (id: string, name: string) => Promise<void>;
  deleteBuilding: (id: string) => Promise<void>;
  addDepartment: (dept: Department) => Promise<void>;
  updateDepartment: (id: string, name: string, buildingId: string) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>(MOCK_BUILDINGS); // 로딩 전 fallback
  const [departments, setDepartments] = useState<Department[]>(MOCK_DEPARTMENTS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrganizationData = async () => {
    try {
      const [bRes, dRes] = await Promise.all([
        supabase.from('kc_buildings').select('id,name').order('id'),
        supabase.from('kc_departments').select('id,name,building_id').order('id'),
      ]);

      if (bRes.error) throw bRes.error;
      if (dRes.error) throw dRes.error;

      if (bRes.data && bRes.data.length > 0) {
        setBuildings(bRes.data.map((b) => ({ id: b.id, name: b.name })));
      }
      if (dRes.data && dRes.data.length > 0) {
        setDepartments(
          dRes.data.map((d) => ({ id: d.id, name: d.name, buildingId: d.building_id }))
        );
      }
    } catch (error) {
      console.error('Error fetching organization data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizationData();
  }, []);

  const addBuilding = async (b: Building) => {
    await supabase.from('kc_buildings').upsert({ id: b.id, name: b.name });
    await fetchOrganizationData();
  };

  const updateBuilding = async (id: string, name: string) => {
    await supabase.from('kc_buildings').update({ name }).eq('id', id);
    await fetchOrganizationData();
  };

  const deleteBuilding = async (id: string) => {
    await supabase.from('kc_buildings').delete().eq('id', id);
    await fetchOrganizationData();
  };

  const addDepartment = async (d: Department) => {
    await supabase
      .from('kc_departments')
      .upsert({ id: d.id, name: d.name, building_id: d.buildingId });
    await fetchOrganizationData();
  };

  const updateDepartment = async (id: string, name: string, buildingId: string) => {
    await supabase
      .from('kc_departments')
      .update({ name, building_id: buildingId })
      .eq('id', id);
    await fetchOrganizationData();
  };

  const deleteDepartment = async (id: string) => {
    await supabase.from('kc_departments').delete().eq('id', id);
    await fetchOrganizationData();
  };

  return (
    <OrganizationContext.Provider
      value={{
        buildings,
        departments,
        isLoading,
        addBuilding,
        updateBuilding,
        deleteBuilding,
        addDepartment,
        updateDepartment,
        deleteDepartment,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within an OrganizationProvider');
  return ctx;
};
