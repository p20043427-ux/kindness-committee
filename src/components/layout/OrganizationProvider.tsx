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
  const [buildings, setBuildings] = useState<Building[]>(MOCK_BUILDINGS);
  const [departments, setDepartments] = useState<Department[]>(MOCK_DEPARTMENTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [bRes, dRes] = await Promise.all([
          supabase.from('kc_buildings').select('id,name').order('id'),
          supabase.from('kc_departments').select('id,name,building_id').order('id'),
        ]);
        if (bRes.error) throw bRes.error;
        if (dRes.error) throw dRes.error;
        if (bRes.data?.length) setBuildings(bRes.data.map(b => ({ id: b.id, name: b.name })));
        if (dRes.data?.length) setDepartments(dRes.data.map(d => ({ id: d.id, name: d.name, buildingId: d.building_id })));
      } catch (e) {
        console.error('Error fetching organization data:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  /* 낙관적 업데이트 헬퍼 — DB 쓰기 실패 시 롤백 */
  async function optimisticBuilding<T>(
    update: (prev: Building[]) => Building[],
    write: () => Promise<{ error: any }>,
    rollback: Building[]
  ) {
    setBuildings(update);
    const { error } = await write();
    if (error) { setBuildings(rollback); throw error; }
  }

  async function optimisticDept<T>(
    update: (prev: Department[]) => Department[],
    write: () => Promise<{ error: any }>,
    rollback: Department[]
  ) {
    setDepartments(update);
    const { error } = await write();
    if (error) { setDepartments(rollback); throw error; }
  }

  const addBuilding = async (b: Building) => {
    const rollback = buildings;
    await optimisticBuilding(
      prev => [...prev, b],
      () => supabase.from('kc_buildings').upsert({ id: b.id, name: b.name }),
      rollback
    );
  };

  const updateBuilding = async (id: string, name: string) => {
    const rollback = buildings;
    await optimisticBuilding(
      prev => prev.map(b => b.id === id ? { ...b, name } : b),
      () => supabase.from('kc_buildings').update({ name }).eq('id', id),
      rollback
    );
  };

  const deleteBuilding = async (id: string) => {
    const rollback = buildings;
    await optimisticBuilding(
      prev => prev.filter(b => b.id !== id),
      () => supabase.from('kc_buildings').delete().eq('id', id),
      rollback
    );
  };

  const addDepartment = async (d: Department) => {
    const rollback = departments;
    await optimisticDept(
      prev => [...prev, d],
      () => supabase.from('kc_departments').upsert({ id: d.id, name: d.name, building_id: d.buildingId }),
      rollback
    );
  };

  const updateDepartment = async (id: string, name: string, buildingId: string) => {
    const rollback = departments;
    await optimisticDept(
      prev => prev.map(d => d.id === id ? { ...d, name, buildingId } : d),
      () => supabase.from('kc_departments').update({ name, building_id: buildingId }).eq('id', id),
      rollback
    );
  };

  const deleteDepartment = async (id: string) => {
    const rollback = departments;
    await optimisticDept(
      prev => prev.filter(d => d.id !== id),
      () => supabase.from('kc_departments').delete().eq('id', id),
      rollback
    );
  };

  return (
    <OrganizationContext.Provider value={{
      buildings, departments, isLoading,
      addBuilding, updateBuilding, deleteBuilding,
      addDepartment, updateDepartment, deleteDepartment,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within an OrganizationProvider');
  return ctx;
};
