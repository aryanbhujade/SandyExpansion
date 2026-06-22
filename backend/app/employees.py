from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import json

from app.database import get_db, Employee, EmployeeProfile, utcnow
from app.auth import get_current_user_dep

class EmployeeProfileResponse(BaseModel):
    employee_id: str
    name: str
    email: str
    level: str | None = None
    role: str | None = None
    department: str | None = None
    business_unit: str | None = None
    location: str | None = None
    skills: List[str] = []
    expertise_topics: List[str] = []
    projects: List[str] = []
    notes: str | None = None

class ProfileUpdateRequest(BaseModel):
    role: str | None = None
    department: str | None = None
    location: str | None = None
    skills: List[str] | None = None
    expertise_topics: List[str] | None = None
    projects: List[str] | None = None
    notes: str | None = None

router = APIRouter()

class EmployeeResponse(BaseModel):
    employee_id: str
    name: str
    email: str
    level: str | None = None
    role: str | None = None
    department: str | None = None
    business_unit: str | None = None
    location: str | None = None

    class Config:
        from_attributes = True

@router.get("", response_model=List[EmployeeResponse])
def get_employees(
    department: Optional[str] = None,
    level: Optional[str] = None,
    business_unit: Optional[str] = None,
    location: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep),
):
    query = db.query(Employee)
    if department:
        query = query.filter(Employee.department == department)
    if level:
        query = query.filter(Employee.level == level)
    if business_unit:
        query = query.filter(Employee.business_unit == business_unit)
    if location:
        query = query.filter(Employee.location == location)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(Employee.name.ilike(search_filter))
    
    offset = (page - 1) * limit
    employees = query.order_by(Employee.name.asc()).offset(offset).limit(limit).all()
    
    return [
        {
            "employee_id": e.id, 
            "name": e.name, 
            "email": e.email, 
            "level": e.level, 
            "role": e.role, 
            "department": e.department,
            "business_unit": e.business_unit,
            "location": e.location
        } 
        for e in employees
    ]

@router.put("/profile", response_model=EmployeeResponse)
def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user_dep),
    db: Session = Depends(get_db)
):
    my_id = current_user["employee_id"]
    employee = db.query(Employee).filter(Employee.id == my_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    if request.role is not None:
        employee.role = request.role
    if request.department is not None:
        employee.department = request.department
    if request.location is not None:
        employee.location = request.location
        
    profile = db.query(EmployeeProfile).filter(EmployeeProfile.employee_id == my_id).first()
    if not profile:
        profile = EmployeeProfile(employee_id=my_id)
        db.add(profile)
        
    if request.skills is not None:
        profile.skills_json = json.dumps(request.skills)
    if request.expertise_topics is not None:
        profile.expertise_topics_json = json.dumps(request.expertise_topics)
    if request.projects is not None:
        profile.projects_json = json.dumps(request.projects)
    if request.notes is not None:
        profile.notes = request.notes
        
    profile.last_updated = utcnow()
    db.commit()
    db.refresh(employee)
    return {
        "employee_id": employee.id,
        "name": employee.name,
        "email": employee.email,
        "level": employee.level,
        "role": employee.role,
        "department": employee.department,
        "business_unit": employee.business_unit,
        "location": employee.location
    }

@router.get("/{employee_id}/profile", response_model=EmployeeProfileResponse)
def get_employee_profile(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    profile = db.query(EmployeeProfile).filter(EmployeeProfile.employee_id == employee_id).first()
    
    skills = []
    expertise = []
    projects = []
    notes = ""
    if profile:
        skills = json.loads(profile.skills_json) if profile.skills_json else []
        expertise = json.loads(profile.expertise_topics_json) if profile.expertise_topics_json else []
        projects = json.loads(profile.projects_json) if profile.projects_json else []
        notes = profile.notes or ""
        
    return {
        "employee_id": employee.id,
        "name": employee.name,
        "email": employee.email,
        "level": employee.level,
        "role": employee.role,
        "department": employee.department,
        "business_unit": employee.business_unit,
        "location": employee.location,
        "skills": skills,
        "expertise_topics": expertise,
        "projects": projects,
        "notes": notes
    }

@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user_dep),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {
        "employee_id": employee.id, 
        "name": employee.name, 
        "email": employee.email, 
        "level": employee.level, 
        "role": employee.role, 
        "department": employee.department,
        "business_unit": employee.business_unit,
        "location": employee.location
    }
