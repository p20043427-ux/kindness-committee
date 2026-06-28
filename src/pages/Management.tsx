import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { useOrganization, Building, Department } from "@/src/components/layout/OrganizationProvider";
import { useToast } from "@/src/components/ui/Toast";

export function Management() {
  const { buildings, departments, addBuilding, updateBuilding, deleteBuilding, addDepartment, updateDepartment, deleteDepartment } = useOrganization();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"buildings" | "departments">("buildings");

  // Building State
  const [editBuildingId, setEditBuildingId] = useState<string | null>(null);
  const [editBuildingName, setEditBuildingName] = useState("");
  const [newBuildingId, setNewBuildingId] = useState("");
  const [newBuildingName, setNewBuildingName] = useState("");
  const [pendingDeleteBldId, setPendingDeleteBldId] = useState<string | null>(null);
  const [pendingDeleteDeptId, setPendingDeleteDeptId] = useState<string | null>(null);

  // Department State
  const [editDeptId, setEditDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptBld, setEditDeptBld] = useState("");
  const [newDeptId, setNewDeptId] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptBld, setNewDeptBld] = useState("");

  const handleAddBuilding = async () => {
    if (!newBuildingId.trim() || !newBuildingName.trim()) return;
    try {
      await addBuilding({ id: newBuildingId.trim(), name: newBuildingName.trim() });
      setNewBuildingId(""); setNewBuildingName("");
      toast("건물이 추가되었습니다.", "success");
    } catch { toast("건물 추가 중 오류가 발생했습니다.", "error"); }
  };

  const handleSaveBuilding = async (id: string) => {
    if (!editBuildingName.trim()) return;
    try {
      await updateBuilding(id, editBuildingName.trim());
      setEditBuildingId(null);
      toast("건물 정보가 수정되었습니다.", "success");
    } catch { toast("건물 수정 중 오류가 발생했습니다.", "error"); }
  };

  const handleDeleteBuilding = async (id: string) => {
    try {
      await deleteBuilding(id);
      setPendingDeleteBldId(null);
      toast("건물이 삭제되었습니다.", "success");
    } catch { toast("건물 삭제 중 오류가 발생했습니다.", "error"); }
  };

  const handleAddDept = async () => {
    if (!newDeptId.trim() || !newDeptName.trim() || !newDeptBld.trim()) return;
    try {
      await addDepartment({ id: newDeptId.trim(), name: newDeptName.trim(), buildingId: newDeptBld });
      setNewDeptId(""); setNewDeptName("");
      toast("부서가 추가되었습니다.", "success");
    } catch { toast("부서 추가 중 오류가 발생했습니다.", "error"); }
  };

  const handleSaveDept = async (id: string) => {
    if (!editDeptName.trim() || !editDeptBld.trim()) return;
    try {
      await updateDepartment(id, editDeptName.trim(), editDeptBld);
      setEditDeptId(null);
      toast("부서 정보가 수정되었습니다.", "success");
    } catch { toast("부서 수정 중 오류가 발생했습니다.", "error"); }
  };

  const handleDeleteDept = async (id: string) => {
    try {
      await deleteDepartment(id);
      setPendingDeleteDeptId(null);
      toast("부서가 삭제되었습니다.", "success");
    } catch { toast("부서 삭제 중 오류가 발생했습니다.", "error"); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="건물 / 부서 코드 관리"
        description="시스템에서 사용되는 건물과 부서 기초 코드를 관리합니다."
      />

      <div className="flex space-x-2 border-b border-surface-200">
        <button
          onClick={() => setActiveTab("buildings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "buildings" ? "border-primary-500 text-primary-600" : "border-transparent text-surface-500 hover:text-surface-700"
          }`}
        >
          건물 관리
        </button>
        <button
          onClick={() => setActiveTab("departments")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "departments" ? "border-primary-500 text-primary-600" : "border-transparent text-surface-500 hover:text-surface-700"
          }`}
        >
          부서 관리
        </button>
      </div>

      {activeTab === "buildings" && (
        <Card>
          <CardHeader>
            <CardTitle>건물 목록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-end">
              <div className="flex flex-col space-y-1 w-full sm:w-auto">
                <label className="text-xs font-semibold text-surface-500 uppercase">건물 코드 (ID)</label>
                <input 
                  value={newBuildingId} onChange={(e) => setNewBuildingId(e.target.value)}
                  placeholder="예: B04" className="w-full sm:w-32 px-3 py-2 border border-surface-300 rounded text-sm"
                />
              </div>
              <div className="flex flex-col space-y-1 w-full sm:w-auto flex-1">
                <label className="text-xs font-semibold text-surface-500 uppercase">건물명</label>
                <input 
                  value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)}
                  placeholder="예: 암센터" className="w-full px-3 py-2 border border-surface-300 rounded text-sm"
                />
              </div>
              <button 
                onClick={handleAddBuilding}
                className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white font-medium rounded text-sm hover:bg-primary-700 transition"
              >
                + 추가
              </button>
            </div>

            <div className="border border-surface-200 rounded overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-50 text-surface-500 border-b border-surface-200 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-4 py-3 w-32">건물 코드</th>
                    <th className="px-4 py-3">건물명</th>
                    <th className="px-4 py-3 w-32 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {buildings.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-50">
                      <td className="px-4 py-3 font-mono text-surface-600">{b.id}</td>
                      <td className="px-4 py-3">
                        {editBuildingId === b.id ? (
                          <input 
                            value={editBuildingName}
                            onChange={(e) => setEditBuildingName(e.target.value)}
                            className="w-full px-2 py-1 border border-surface-300 rounded text-sm outline-none focus:border-primary-500"
                          />
                        ) : (
                          <span className="font-medium text-surface-900">{b.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {editBuildingId === b.id ? (
                          <>
                            <button onClick={() => handleSaveBuilding(b.id)} className="text-green-600 font-medium text-sm hover:underline">저장</button>
                            <button onClick={() => setEditBuildingId(null)} className="text-surface-500 font-medium text-sm hover:underline">취소</button>
                          </>
                        ) : pendingDeleteBldId === b.id ? (
                          <>
                            <span className="text-xs text-surface-500">정말 삭제?</span>
                            <button onClick={() => handleDeleteBuilding(b.id)} className="text-red-600 font-semibold text-sm hover:underline">확인</button>
                            <button onClick={() => setPendingDeleteBldId(null)} className="text-surface-500 font-medium text-sm hover:underline">취소</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditBuildingId(b.id); setEditBuildingName(b.name); }} className="text-primary-600 font-medium text-sm hover:underline">수정</button>
                            <button onClick={() => setPendingDeleteBldId(b.id)} className="text-red-500 font-medium text-sm hover:underline">삭제</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {buildings.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-surface-500">등록된 건물이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "departments" && (
        <Card>
          <CardHeader>
            <CardTitle>부서 목록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-end">
              <div className="flex flex-col space-y-1 w-full sm:w-auto">
                <label className="text-xs font-semibold text-surface-500 uppercase">부서 코드 (ID)</label>
                <input 
                  value={newDeptId} onChange={(e) => setNewDeptId(e.target.value)}
                  placeholder="예: D99" className="w-full sm:w-28 px-3 py-2 border border-surface-300 rounded text-sm"
                />
              </div>
              <div className="flex flex-col space-y-1 w-full sm:w-auto">
                <label className="text-xs font-semibold text-surface-500 uppercase">소속 건물</label>
                <select 
                  value={newDeptBld} onChange={(e) => setNewDeptBld(e.target.value)}
                  className="w-full sm:w-32 px-3 py-2 border border-surface-300 rounded text-sm bg-white"
                >
                  <option value="">선택</option>
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col space-y-1 w-full sm:w-auto flex-1">
                <label className="text-xs font-semibold text-surface-500 uppercase">부서명</label>
                <input 
                  value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="예: 새로운 부서" className="w-full px-3 py-2 border border-surface-300 rounded text-sm"
                />
              </div>
              <button 
                onClick={handleAddDept}
                className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white font-medium rounded text-sm hover:bg-primary-700 transition"
              >
                + 추가
              </button>
            </div>

            <div className="border border-surface-200 rounded overflow-hidden sm:max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm text-left relative">
                <thead className="bg-surface-50 text-surface-500 border-b border-surface-200 uppercase text-xs font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-28">부서 코드</th>
                    <th className="px-4 py-3 w-32">소속 건물</th>
                    <th className="px-4 py-3">부서명</th>
                    <th className="px-4 py-3 w-32 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {departments.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-50">
                      <td className="px-4 py-3 font-mono text-surface-600">{d.id}</td>
                      <td className="px-4 py-3">
                        {editDeptId === d.id ? (
                          <select 
                            value={editDeptBld} onChange={(e) => setEditDeptBld(e.target.value)}
                            className="w-full px-2 py-1 border border-surface-300 rounded text-sm"
                          >
                            <option value="">선택</option>
                            {buildings.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-surface-700">{buildings.find(b => b.id === d.buildingId)?.name || d.buildingId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editDeptId === d.id ? (
                          <input 
                            value={editDeptName}
                            onChange={(e) => setEditDeptName(e.target.value)}
                            className="w-full px-2 py-1 border border-surface-300 rounded text-sm outline-none focus:border-primary-500"
                          />
                        ) : (
                          <span className="font-medium text-surface-900">{d.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {editDeptId === d.id ? (
                          <>
                            <button onClick={() => handleSaveDept(d.id)} className="text-green-600 font-medium text-sm hover:underline">저장</button>
                            <button onClick={() => setEditDeptId(null)} className="text-surface-500 font-medium text-sm hover:underline">취소</button>
                          </>
                        ) : pendingDeleteDeptId === d.id ? (
                          <>
                            <span className="text-xs text-surface-500">정말 삭제?</span>
                            <button onClick={() => handleDeleteDept(d.id)} className="text-red-600 font-semibold text-sm hover:underline">확인</button>
                            <button onClick={() => setPendingDeleteDeptId(null)} className="text-surface-500 font-medium text-sm hover:underline">취소</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditDeptId(d.id); setEditDeptName(d.name); setEditDeptBld(d.buildingId); }} className="text-primary-600 font-medium text-sm hover:underline">수정</button>
                            <button onClick={() => setPendingDeleteDeptId(d.id)} className="text-red-500 font-medium text-sm hover:underline">삭제</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {departments.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-500">등록된 부서가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
