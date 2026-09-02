// src/SearchBar.jsx
import React from 'react';
import './Eduvhibe.css';

export default function SearchBar({ placeholder, onSearch, onFilter, filterOptions }) {
  return (
    <div className="notes-toolbar edu-toolbar">
      <input 
        type="text" 
        placeholder={placeholder || "Search..."} 
        className="notes-search-input edu-toolbar-input" 
        onChange={(e) => onSearch(e.target.value)} 
      />
      
      {filterOptions && (
        <select className="notes-filter edu-toolbar-filter" onChange={(e) => onFilter(e.target.value)}>
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
