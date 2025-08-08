import React from 'react';
import { readGraphql, readFragment, type FragmentOf } from './graphql/operations/read-graphql';

// Colocated fragment for UserCard component
const UserCardFragment = readGraphql(`
  fragment UserCard on User {
    id
    name
    email
    createdAt
  }
`);

// Props type using fragment masking
interface UserCardProps {
  user: FragmentOf<typeof UserCardFragment>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

// Component that only has access to fragment data
export function UserCard({ user, onEdit, onDelete, className = '' }: UserCardProps) {
  // Unmask fragment to access data
  const userData = readFragment(UserCardFragment, user);
  
  const createdDate = new Date(userData.createdAt);
  const formattedDate = createdDate.toLocaleDateString();
  
  return (
    <div className={`user-card ${className}`}>
      <div className="user-card__header">
        <h3 className="user-card__name">{userData.name}</h3>
        <span className="user-card__id">#{userData.id.slice(0, 8)}</span>
      </div>
      
      <div className="user-card__content">
        <p className="user-card__email">
          <span className="label">Email:</span> {userData.email}
        </p>
        <p className="user-card__created">
          <span className="label">Member since:</span> {formattedDate}
        </p>
      </div>
      
      {(onEdit || onDelete) && (
        <div className="user-card__actions">
          {onEdit && (
            <button 
              className="btn btn--secondary"
              onClick={() => onEdit(userData.id)}
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button 
              className="btn btn--danger"
              onClick={() => onDelete(userData.id)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Export the fragment for use in queries
export { UserCardFragment };