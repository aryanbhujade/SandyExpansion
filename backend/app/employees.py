from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db, Employee
from app.auth import get_current_user_dep

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
