import { useState, useEffect } from 'react';

interface EmailFieldGroup {
  [key: string]: string | boolean;
  preserve: boolean;
}

interface EmailFields {
  solicitant: {
    name: string;
    address: string;
    email: string;
    preserve: boolean;
  };
  greeting: {
    institution: string;
    name: string;
    preserve: boolean;
  };
  request: {
    content: string;
    preserve: boolean;
  };
  closing: {
    email: string;
    name: string;
    preserve: boolean;
  };
}

/**
 * Custom hook for managing individual email fields with auto-sync
 * Handles field storage, preservation, and synchronization
 */
export const useEmailFields = () => {
  const [fields, setFields] = useState<EmailFields>({
    // Group 1: Date Solicitant
    solicitant: {
      name: '',
      address: '',
      email: '',
      preserve: true,
    },
    // Group 2: Greeting
    greeting: {
      institution: '',
      name: '',
      preserve: true,
    },
    // Group 3: Request content (always new)
    request: {
      content: '',
      preserve: false,
    },
    // Group 4: Closing
    closing: {
      email: '',
      name: '',
      preserve: true,
    },
  });

  // Load fields from localStorage on mount
  useEffect(() => {
    const savedFields = localStorage.getItem('emailFields');
    if (savedFields) {
      try {
        const parsed = JSON.parse(savedFields);
        setFields((prev) => ({
          solicitant: {
            name: parsed?.solicitant?.name ?? prev.solicitant.name,
            address: parsed?.solicitant?.address ?? prev.solicitant.address,
            email: parsed?.solicitant?.email ?? prev.solicitant.email,
            preserve: parsed?.solicitant?.preserve ?? true,
          },
          greeting: {
            institution: parsed?.greeting?.institution ?? prev.greeting.institution,
            name: parsed?.greeting?.name ?? prev.greeting.name,
            preserve: parsed?.greeting?.preserve ?? true,
          },
          request: {
            content: parsed?.request?.content ?? prev.request.content,
            preserve: parsed?.request?.preserve ?? false,
          },
          closing: {
            email: parsed?.closing?.email ?? prev.closing.email,
            name: parsed?.closing?.name ?? prev.closing.name,
            preserve: parsed?.closing?.preserve ?? true,
          },
        }));
      } catch (error) {
        console.error('Error loading fields:', error);
      }
    }
  }, []);

  // Save fields to localStorage when they change
  useEffect(() => {
    localStorage.setItem('emailFields', JSON.stringify(fields));
  }, [fields]);

  // Update specific field
  const updateField = (group: keyof EmailFields, field: string, value: string) => {
    setFields(prev => {
      const newFields = {
        ...prev,
        [group]: {
          ...prev[group],
          [field]: value
        }
      };

      // Auto-sync fields
      if (group === 'solicitant' && field === 'name') {
        // Sync name to greeting and closing
        newFields.greeting.name = value;
        newFields.closing.name = value;
      }

      if (group === 'solicitant' && field === 'email') {
        // Sync email to closing
        newFields.closing.email = value;
      }

      return newFields;
    });
  };

  // Toggle preserve status for group
  const togglePreserve = (group: keyof EmailFields) => {
    setFields(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        preserve: !prev[group].preserve
      }
    }));
  };

  // Get final email body by combining fields
  const getEmailBody = (): string => {
    const sections: string[] = [];

    // Group 1: Date Solicitant
    if (fields.solicitant.name || fields.solicitant.address || fields.solicitant.email) {
      const solicitantSection = [];
      if (fields.solicitant.name) solicitantSection.push(`Solicitant: ${fields.solicitant.name}`);
      if (fields.solicitant.address) solicitantSection.push(`Adresa: ${fields.solicitant.address}`);
      if (fields.solicitant.email) solicitantSection.push(`Email: ${fields.solicitant.email}`);
      sections.push(solicitantSection.join('\n'));
    }

    // Group 2: Greeting
    if (fields.greeting.institution || fields.greeting.name) {
      const greetingSection = [];
      if (fields.greeting.institution) {
        greetingSection.push(`Stimate reprezentant al ${fields.greeting.institution},`);
      }
      if (fields.greeting.name) {
        greetingSection.push(`\nSubsemnatul ${fields.greeting.name}, cu datele de contact menționate mai sus, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:`);
      }
      sections.push(greetingSection.join(''));
    }

    // Group 3: Request content
    if (fields.request.content) {
      sections.push(fields.request.content);
    }

    // Group 4: Closing
    if (fields.closing.email || fields.closing.name) {
      const closingSection = [];
      if (fields.closing.email) {
        closingSection.push(`Aștept cu interes răspunsul dumneavoastră la adresa de email ${fields.closing.email} și vă mulțumesc anticipat pentru cooperare.`);
      }
      if (fields.closing.name) {
        closingSection.push(`\n\nCu stimă,\n${fields.closing.name}`);
      }
      sections.push(closingSection.join(''));
    }

    return sections.join('\n\n');
  };

  // Clear non-preserved fields for new email
  const clearForNewEmail = () => {
    setFields(prev => ({
      solicitant: {
        name: prev.solicitant.preserve ? prev.solicitant.name : '',
        address: prev.solicitant.preserve ? prev.solicitant.address : '',
        email: prev.solicitant.preserve ? prev.solicitant.email : '',
        preserve: prev.solicitant.preserve
      },
      greeting: {
        institution: prev.greeting.preserve ? prev.greeting.institution : '',
        name: prev.greeting.preserve ? prev.greeting.name : '',
        preserve: prev.greeting.preserve
      },
      request: {
        content: '', // Always clear request content
        preserve: false
      },
      closing: {
        email: prev.closing.preserve ? prev.closing.email : '',
        name: prev.closing.preserve ? prev.closing.name : '',
        preserve: prev.closing.preserve
      }
    }));
  };

  // Reset all fields
  const resetFields = () => {
    setFields({
      solicitant: { name: '', address: '', email: '', preserve: true },
      greeting: { institution: '', name: '', preserve: true },
      request: { content: '', preserve: false },
      closing: { email: '', name: '', preserve: true },
    });
  };

  // Load example fields
  const loadExampleFields = () => {
    setFields({
      solicitant: {
        name: '',
        address: '',
        email: '',
        preserve: true,
      },
      greeting: {
        institution: '',
        name: '',
        preserve: true,
      },
      request: {
        content: '',
        preserve: false,
      },
      closing: {
        email: '',
        name: '',
        preserve: true,
      },
    });
  };

  return {
    fields,
    updateField,
    togglePreserve,
    getEmailBody,
    clearForNewEmail,
    resetFields,
    loadExampleFields
  };
};
