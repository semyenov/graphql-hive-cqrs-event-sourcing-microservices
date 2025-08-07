import React, { useState } from 'react';
import { writeGraphql, readFragment, type ResultOf } from '../graphql/write-graphql';
import * as UserFragments from '../graphql/fragments/user.fragments';

// Mutation for creating users
const CREATE_USER_MUTATION = writeGraphql(`
  mutation CreateUserForm($input: CreateUserInput!) {
    createUser(input: $input) {
      success
      user {
        ...WriteUserFields
      }
      errors {
        ...ErrorFields
      }
    }
  }
`, [UserFragments.WriteUserFieldsFragment, UserFragments.ErrorFieldsFragment]);

type CreateUserResult = ResultOf<typeof CREATE_USER_MUTATION>;

interface CreateUserFormProps {
  onSuccess?: (user: any) => void;
  onCancel?: () => void;
}

export function CreateUserForm({ onSuccess, onCancel }: CreateUserFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CREATE_USER_MUTATION,
          variables: {
            input: formData,
          },
        }),
      });

      const result: { data: CreateUserResult } = await response.json();
      
      if (result.data.createUser.success) {
        const user = result.data.createUser.user 
          ? readFragment(UserFragments.WriteUserFieldsFragment, result.data.createUser.user)
          : null;
          
        if (user && onSuccess) {
          onSuccess(user);
        }
        
        // Reset form
        setFormData({ name: '', email: '' });
      } else {
        // Handle errors
        const errorMap: Record<string, string> = {};
        result.data.createUser.errors?.forEach(error => {
          const errorData = readFragment(UserFragments.ErrorFieldsFragment, error);
          if (errorData.field) {
            errorMap[errorData.field] = errorData.message;
          } else {
            errorMap.general = errorData.message;
          }
        });
        setErrors(errorMap);
      }
    } catch (err) {
      setErrors({ general: 'Failed to create user' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <form className="create-user-form" onSubmit={handleSubmit}>
      <h3>Create New User</h3>
      
      {errors.general && (
        <div className="form__error form__error--general">
          {errors.general}
        </div>
      )}
      
      <div className="form__group">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          disabled={loading}
          required
          className={errors.name ? 'error' : ''}
        />
        {errors.name && (
          <span className="form__error">{errors.name}</span>
        )}
      </div>
      
      <div className="form__group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          disabled={loading}
          required
          className={errors.email ? 'error' : ''}
        />
        {errors.email && (
          <span className="form__error">{errors.email}</span>
        )}
      </div>
      
      <div className="form__actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
        
        {onCancel && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}