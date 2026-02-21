"""
Test suite for Drawlead AI Module
Tests AI chat endpoints, suggested prompts, quick actions, and conversation management
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://design-kanban-hub.preview.emergentagent.com').rstrip('/')

class TestAIAuth:
    """Authentication tests for AI module"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        """Login and get session token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "session_token" in data
        return data["session_token"]
    
    def test_login_admin(self, session_token):
        """Test admin login works"""
        assert session_token is not None
        assert session_token.startswith("session_")


class TestAISuggestedPrompts:
    """Test suggested prompts endpoint"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_get_general_prompts(self, session_token):
        """Test GET /api/ai/suggested-prompts/general"""
        response = requests.get(
            f"{BASE_URL}/api/ai/suggested-prompts/general",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        prompts = response.json()
        assert isinstance(prompts, list)
        assert len(prompts) > 0
        print(f"General prompts: {prompts}")
    
    def test_get_sales_prompts(self, session_token):
        """Test GET /api/ai/suggested-prompts/sales"""
        response = requests.get(
            f"{BASE_URL}/api/ai/suggested-prompts/sales",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        prompts = response.json()
        assert isinstance(prompts, list)
        assert len(prompts) > 0
        # Sales prompts should contain sales-related keywords
        prompts_text = " ".join(prompts).lower()
        assert any(word in prompts_text for word in ["lead", "follow", "deal", "pipeline", "close"])
        print(f"Sales prompts: {prompts}")
    
    def test_get_operations_prompts(self, session_token):
        """Test GET /api/ai/suggested-prompts/operations"""
        response = requests.get(
            f"{BASE_URL}/api/ai/suggested-prompts/operations",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        prompts = response.json()
        assert isinstance(prompts, list)
        assert len(prompts) > 0
        # Operations prompts should contain operations-related keywords
        prompts_text = " ".join(prompts).lower()
        assert any(word in prompts_text for word in ["project", "task", "workflow", "workload", "bottleneck"])
        print(f"Operations prompts: {prompts}")
    
    def test_get_marketing_prompts(self, session_token):
        """Test GET /api/ai/suggested-prompts/marketing"""
        response = requests.get(
            f"{BASE_URL}/api/ai/suggested-prompts/marketing",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        prompts = response.json()
        assert isinstance(prompts, list)
        assert len(prompts) > 0
        print(f"Marketing prompts: {prompts}")
    
    def test_get_finance_prompts(self, session_token):
        """Test GET /api/ai/suggested-prompts/finance"""
        response = requests.get(
            f"{BASE_URL}/api/ai/suggested-prompts/finance",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        prompts = response.json()
        assert isinstance(prompts, list)
        assert len(prompts) > 0
        print(f"Finance prompts: {prompts}")
    
    def test_get_unknown_context_prompts(self, session_token):
        """Test GET /api/ai/suggested-prompts/unknown - should return general prompts"""
        response = requests.get(
            f"{BASE_URL}/api/ai/suggested-prompts/unknown",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        prompts = response.json()
        assert isinstance(prompts, list)
        # Should return general prompts for unknown context
        print(f"Unknown context prompts: {prompts}")


class TestAIChat:
    """Test AI chat endpoints"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_chat_general_context(self, session_token):
        """Test POST /api/ai/chat with general context"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "prompt": "Hello, what can you help me with?",
                "context_type": "general"
            },
            timeout=60  # AI responses can take time
        )
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "response" in data
        assert "conversation_id" in data
        assert "context_type" in data
        assert data["context_type"] == "general"
        assert len(data["response"]) > 0
        print(f"AI Response (general): {data['response'][:200]}...")
        return data["conversation_id"]
    
    def test_chat_sales_context(self, session_token):
        """Test POST /api/ai/chat with sales context"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "prompt": "Which leads need follow-up today?",
                "context_type": "sales"
            },
            timeout=60
        )
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "response" in data
        assert data["context_type"] == "sales"
        print(f"AI Response (sales): {data['response'][:200]}...")
    
    def test_chat_operations_context(self, session_token):
        """Test POST /api/ai/chat with operations context"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "prompt": "What projects are at risk?",
                "context_type": "operations"
            },
            timeout=60
        )
        assert response.status_code == 200, f"Chat failed: {response.text}"
        data = response.json()
        assert "response" in data
        assert data["context_type"] == "operations"
        print(f"AI Response (operations): {data['response'][:200]}...")
    
    def test_chat_unauthorized(self):
        """Test POST /api/ai/chat without auth - should fail"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={
                "prompt": "Hello",
                "context_type": "general"
            }
        )
        assert response.status_code == 401


class TestAIConversations:
    """Test conversation management endpoints"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    @pytest.fixture(scope="class")
    def conversation_id(self, session_token):
        """Create a conversation for testing"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "prompt": "TEST_conversation: Hello AI",
                "context_type": "general"
            },
            timeout=60
        )
        assert response.status_code == 200
        return response.json()["conversation_id"]
    
    def test_get_conversations(self, session_token):
        """Test GET /api/ai/conversations"""
        response = requests.get(
            f"{BASE_URL}/api/ai/conversations",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        conversations = response.json()
        assert isinstance(conversations, list)
        print(f"Found {len(conversations)} conversations")
    
    def test_continue_conversation(self, session_token, conversation_id):
        """Test POST /api/ai/chat/{conversation_id} - continue existing conversation"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat/{conversation_id}",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "prompt": "Can you tell me more?",
                "context_type": "general"
            },
            timeout=60
        )
        assert response.status_code == 200, f"Continue conversation failed: {response.text}"
        data = response.json()
        assert "response" in data
        assert data["conversation_id"] == conversation_id
        print(f"Continued conversation response: {data['response'][:200]}...")
    
    def test_get_specific_conversation(self, session_token, conversation_id):
        """Test GET /api/ai/conversations/{conversation_id}"""
        response = requests.get(
            f"{BASE_URL}/api/ai/conversations/{conversation_id}",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        conversation = response.json()
        assert conversation["conversation_id"] == conversation_id
        assert "messages" in conversation
        assert len(conversation["messages"]) >= 2  # At least user + assistant messages
        print(f"Conversation has {len(conversation['messages'])} messages")
    
    def test_delete_conversation(self, session_token, conversation_id):
        """Test DELETE /api/ai/conversations/{conversation_id}"""
        response = requests.delete(
            f"{BASE_URL}/api/ai/conversations/{conversation_id}",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 200
        
        # Verify deletion
        response = requests.get(
            f"{BASE_URL}/api/ai/conversations/{conversation_id}",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 404
    
    def test_get_nonexistent_conversation(self, session_token):
        """Test GET /api/ai/conversations/{invalid_id} - should return 404"""
        response = requests.get(
            f"{BASE_URL}/api/ai/conversations/nonexistent_conv_id",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        assert response.status_code == 404


class TestAIQuickActions:
    """Test AI quick action endpoints"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    @pytest.fixture(scope="class")
    def lead_id(self, session_token):
        """Get a lead ID for testing"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["lead_id"]
        return None
    
    def test_follow_up_suggestions(self, session_token):
        """Test POST /api/ai/quick/follow-up-suggestions"""
        response = requests.post(
            f"{BASE_URL}/api/ai/quick/follow-up-suggestions",
            headers={"Authorization": f"Bearer {session_token}"},
            timeout=60
        )
        assert response.status_code == 200, f"Follow-up suggestions failed: {response.text}"
        data = response.json()
        assert "response" in data
        assert "conversation_id" in data
        print(f"Follow-up suggestions: {data['response'][:200]}...")
    
    def test_project_analysis(self, session_token):
        """Test POST /api/ai/quick/project-analysis"""
        response = requests.post(
            f"{BASE_URL}/api/ai/quick/project-analysis",
            headers={"Authorization": f"Bearer {session_token}"},
            timeout=60
        )
        assert response.status_code == 200, f"Project analysis failed: {response.text}"
        data = response.json()
        assert "response" in data
        assert data["context_type"] == "operations"
        print(f"Project analysis: {data['response'][:200]}...")
    
    def test_lead_summary(self, session_token, lead_id):
        """Test POST /api/ai/quick/lead-summary"""
        if not lead_id:
            pytest.skip("No leads available for testing")
        
        response = requests.post(
            f"{BASE_URL}/api/ai/quick/lead-summary?lead_id={lead_id}",
            headers={"Authorization": f"Bearer {session_token}"},
            timeout=60
        )
        assert response.status_code == 200, f"Lead summary failed: {response.text}"
        data = response.json()
        assert "response" in data
        assert data["context_type"] == "sales"
        print(f"Lead summary: {data['response'][:200]}...")
    
    def test_lead_summary_invalid_lead(self, session_token):
        """Test POST /api/ai/quick/lead-summary with invalid lead_id"""
        response = requests.post(
            f"{BASE_URL}/api/ai/quick/lead-summary?lead_id=invalid_lead_id",
            headers={"Authorization": f"Bearer {session_token}"},
            timeout=60
        )
        assert response.status_code == 404


class TestAIContextAwareness:
    """Test that AI responses are contextually relevant"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "vinoth@drawlead.com",
            "password": "admin123"
        })
        return response.json()["session_token"]
    
    def test_sales_context_mentions_leads(self, session_token):
        """Test that sales context AI mentions lead-related data"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "prompt": "Give me a summary of the current sales situation",
                "context_type": "sales"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        # AI should mention leads or sales-related terms
        response_lower = data["response"].lower()
        assert any(word in response_lower for word in ["lead", "sales", "deal", "pipeline", "status", "follow"])
        print(f"Sales context response: {data['response'][:300]}...")
    
    def test_operations_context_mentions_projects(self, session_token):
        """Test that operations context AI mentions project-related data"""
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "prompt": "What's the current operations status?",
                "context_type": "operations"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        # AI should mention operations-related terms
        response_lower = data["response"].lower()
        assert any(word in response_lower for word in ["project", "task", "database", "operation", "workflow", "status"])
        print(f"Operations context response: {data['response'][:300]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
