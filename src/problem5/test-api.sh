#!/bin/bash

# E-Commerce API Test Script
# Tests all API endpoints with pass/fail assertions
# Usage: ./test-api.sh [base_url]

BASE_URL="${1:-http://localhost:3000}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
declare -a FAILED_TESTS

# Stored IDs for later use
USER_ID=""
USER_ID_2=""
PRODUCT_ID=""
PRODUCT_ID_2=""
PRODUCT_ID_3=""
ORDER_ID=""
ORDER_ID_2=""

# Response storage
LAST_BODY=""
LAST_STATUS=""

# Helper functions
print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

print_test() {
    echo ""
    echo -e "${YELLOW}▶ TEST: $1${NC}"
}

# Make HTTP request
# Usage: do_request METHOD ENDPOINT [DATA]
# Sets: LAST_STATUS, LAST_BODY
do_request() {
    local method=$1
    local endpoint=$2
    local data=$3

    echo -e "  ${BLUE}→ $method $endpoint${NC}"
    if [ -n "$data" ]; then
        echo -e "  ${BLUE}  Body: $data${NC}"
    fi

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${BASE_URL}${endpoint}" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            "${BASE_URL}${endpoint}" 2>/dev/null)
    fi

    LAST_BODY=$(echo "$response" | sed '$d')
    LAST_STATUS=$(echo "$response" | tail -n1)

    echo -e "  ${BLUE}← Status: $LAST_STATUS${NC}"
}

# Assert status code equals expected
# Usage: assert_status EXPECTED_STATUS TEST_NAME
assert_status() {
    local expected=$1
    local test_name=$2

    if [ "$LAST_STATUS" -eq "$expected" ] 2>/dev/null; then
        echo -e "  ${GREEN}✓ PASS${NC}: $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "  ${RED}✗ FAIL${NC}: $test_name"
        echo -e "  ${RED}  Expected status: $expected, Got: $LAST_STATUS${NC}"
        if [ -n "$LAST_BODY" ]; then
            echo -e "  ${RED}  Response: ${LAST_BODY:0:200}${NC}"
        fi
        ((TESTS_FAILED++))
        FAILED_TESTS+=("$test_name (expected $expected, got $LAST_STATUS)")
        return 1
    fi
}

# Assert body contains string
# Usage: assert_contains EXPECTED_STRING TEST_NAME
assert_contains() {
    local expected=$1
    local test_name=$2

    if echo "$LAST_BODY" | grep -q "$expected"; then
        echo -e "  ${GREEN}✓ PASS${NC}: $test_name"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "  ${RED}✗ FAIL${NC}: $test_name"
        echo -e "  ${RED}  Expected to contain: $expected${NC}"
        echo -e "  ${RED}  Response: ${LAST_BODY:0:200}${NC}"
        ((TESTS_FAILED++))
        FAILED_TESTS+=("$test_name (missing: $expected)")
        return 1
    fi
}

# Extract ID from JSON response
extract_id() {
    if command -v jq &> /dev/null; then
        echo "$LAST_BODY" | jq -r '.id // empty' 2>/dev/null
    else
        echo "$LAST_BODY" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*'
    fi
}

# Extract field value from JSON
extract_field() {
    local field=$1
    if command -v jq &> /dev/null; then
        echo "$LAST_BODY" | jq -r ".$field // empty" 2>/dev/null
    else
        echo "$LAST_BODY" | grep -o "\"$field\":[0-9]*" | head -1 | grep -o '[0-9]*'
    fi
}

# Wait for service to be ready
wait_for_service() {
    echo -e "${YELLOW}Waiting for API to be ready...${NC}"
    for i in {1..60}; do
        response=$(curl -s "${BASE_URL}/health" 2>/dev/null)
        if echo "$response" | grep -q '"status":"ok"'; then
            echo -e "${GREEN}API is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    echo -e "\n${RED}Timeout waiting for API${NC}"
    exit 1
}

# ============================================================================
# MAIN TEST SCRIPT
# ============================================================================

print_header "E-Commerce API Test Suite"
echo "Base URL: $BASE_URL"
echo "Time: $(date)"

wait_for_service

# ============================================================================
# 1. HEALTH CHECK
# ============================================================================
print_header "1. HEALTH CHECK"

print_test "Health endpoint returns OK with database status"
do_request "GET" "/health"
assert_status 200 "GET /health returns 200"
assert_contains '"status":"ok"' "Response has status ok"
assert_contains '"database":"ok"' "Database check is ok"

# ============================================================================
# 2. USERS CRUD
# ============================================================================
print_header "2. USERS CRUD OPERATIONS"

print_test "Create user with valid data"
do_request "POST" "/users" '{"email":"john@example.com","name":"John Doe","role":"customer"}'
assert_status 201 "POST /users returns 201 Created"
USER_ID=$(extract_id)
[ -n "$USER_ID" ] && echo -e "  ${GREEN}→ Saved USER_ID: $USER_ID${NC}"

print_test "Create admin user"
do_request "POST" "/users" '{"email":"admin@example.com","name":"Admin User","role":"admin"}'
assert_status 201 "POST /users (admin) returns 201"
USER_ID_2=$(extract_id)
[ -n "$USER_ID_2" ] && echo -e "  ${GREEN}→ Saved USER_ID_2: $USER_ID_2${NC}"

print_test "Create user with duplicate email should fail"
do_request "POST" "/users" '{"email":"john@example.com","name":"Another John"}'
assert_status 409 "POST /users duplicate returns 409 Conflict"

print_test "Create user without required email should fail"
do_request "POST" "/users" '{"name":"No Email User"}'
assert_status 400 "POST /users missing email returns 400"

print_test "List all users"
do_request "GET" "/users"
assert_status 200 "GET /users returns 200"
assert_contains '"data"' "Response has data array"
assert_contains '"pagination"' "Response has pagination"

print_test "Filter users by role"
do_request "GET" "/users?role=admin"
assert_status 200 "GET /users?role=admin returns 200"

print_test "Filter users by name (partial match)"
do_request "GET" "/users?name=john"
assert_status 200 "GET /users?name=john returns 200"

if [ -n "$USER_ID" ]; then
    print_test "Get user by ID"
    do_request "GET" "/users/$USER_ID"
    assert_status 200 "GET /users/:id returns 200"
    assert_contains '"email":"john@example.com"' "Response has correct email"

    print_test "Update user name"
    do_request "PATCH" "/users/$USER_ID" '{"name":"John Updated"}'
    assert_status 200 "PATCH /users/:id returns 200"
    assert_contains '"name":"John Updated"' "Name was updated"
fi

print_test "Get non-existent user should return 404"
do_request "GET" "/users/99999"
assert_status 404 "GET /users/99999 returns 404"

# ============================================================================
# 3. PRODUCTS CRUD
# ============================================================================
print_header "3. PRODUCTS CRUD OPERATIONS"

print_test "Create active product"
do_request "POST" "/products" '{"name":"Wireless Keyboard","description":"High-quality keyboard","price":"99.99","stock":50,"status":"active"}'
assert_status 201 "POST /products returns 201"
PRODUCT_ID=$(extract_id)
[ -n "$PRODUCT_ID" ] && echo -e "  ${GREEN}→ Saved PRODUCT_ID: $PRODUCT_ID${NC}"

print_test "Create second active product"
do_request "POST" "/products" '{"name":"Gaming Mouse","description":"Ergonomic mouse","price":"49.99","stock":100,"status":"active"}'
assert_status 201 "POST /products (mouse) returns 201"
PRODUCT_ID_2=$(extract_id)
[ -n "$PRODUCT_ID_2" ] && echo -e "  ${GREEN}→ Saved PRODUCT_ID_2: $PRODUCT_ID_2${NC}"

print_test "Create draft product"
do_request "POST" "/products" '{"name":"Upcoming Headset","description":"Coming soon","price":"149.99","stock":0,"status":"draft"}'
assert_status 201 "POST /products (draft) returns 201"
PRODUCT_ID_3=$(extract_id)
[ -n "$PRODUCT_ID_3" ] && echo -e "  ${GREEN}→ Saved PRODUCT_ID_3 (draft): $PRODUCT_ID_3${NC}"

print_test "Create product with number price should fail (must be string)"
do_request "POST" "/products" '{"name":"Bad Product","price":10}'
assert_status 400 "POST /products with number price returns 400"

print_test "Create product with invalid price format should fail"
do_request "POST" "/products" '{"name":"Bad Product","price":"invalid"}'
assert_status 400 "POST /products invalid price returns 400"

print_test "List all products"
do_request "GET" "/products"
assert_status 200 "GET /products returns 200"

print_test "Filter products by status"
do_request "GET" "/products?status=active"
assert_status 200 "GET /products?status=active returns 200"

print_test "Filter products by price range"
do_request "GET" "/products?minPrice=50&maxPrice=100"
assert_status 200 "GET /products price range filter returns 200"

print_test "Sort products by price ascending"
do_request "GET" "/products?sortBy=price&order=asc"
assert_status 200 "GET /products sorted returns 200"

if [ -n "$PRODUCT_ID" ]; then
    print_test "Get product by ID"
    do_request "GET" "/products/$PRODUCT_ID"
    assert_status 200 "GET /products/:id returns 200"

    print_test "Update product stock"
    do_request "PATCH" "/products/$PRODUCT_ID" '{"stock":45}'
    assert_status 200 "PATCH /products/:id returns 200"
    assert_contains '"stock":45' "Stock updated to 45"
fi

print_test "Get non-existent product should return 404"
do_request "GET" "/products/99999"
assert_status 404 "GET /products/99999 returns 404"

# ============================================================================
# 4. ORDERS CRUD
# ============================================================================
print_header "4. ORDERS CRUD OPERATIONS"

if [ -n "$USER_ID" ] && [ -n "$PRODUCT_ID" ] && [ -n "$PRODUCT_ID_2" ]; then
    print_test "Create order with multiple items"
    do_request "POST" "/orders" "{\"userId\":$USER_ID,\"shippingAddress\":\"123 Main St, City, Country 12345\",\"items\":[{\"productId\":$PRODUCT_ID,\"quantity\":2},{\"productId\":$PRODUCT_ID_2,\"quantity\":1}]}"
    assert_status 201 "POST /orders returns 201"
    ORDER_ID=$(extract_id)
    [ -n "$ORDER_ID" ] && echo -e "  ${GREEN}→ Saved ORDER_ID: $ORDER_ID${NC}"

    print_test "Verify stock reduced after order (45 - 2 = 43)"
    do_request "GET" "/products/$PRODUCT_ID"
    assert_status 200 "GET /products/:id returns 200"
    assert_contains '"stock":43' "Stock reduced to 43"
else
    echo -e "${RED}⚠ Skipping order creation tests - missing prerequisites${NC}"
fi

print_test "Create order with non-existent user should fail"
do_request "POST" "/orders" '{"userId":99999,"shippingAddress":"Test Address, City","items":[{"productId":1,"quantity":1}]}'
assert_status 404 "POST /orders invalid user returns 404"

if [ -n "$USER_ID" ]; then
    print_test "Create order with non-existent product should fail"
    do_request "POST" "/orders" "{\"userId\":$USER_ID,\"shippingAddress\":\"Test Address\",\"items\":[{\"productId\":99999,\"quantity\":1}]}"
    assert_status 404 "POST /orders invalid product returns 404"
fi

if [ -n "$USER_ID" ] && [ -n "$PRODUCT_ID_3" ]; then
    print_test "Create order with draft product should fail"
    do_request "POST" "/orders" "{\"userId\":$USER_ID,\"shippingAddress\":\"Test Address, City\",\"items\":[{\"productId\":$PRODUCT_ID_3,\"quantity\":1}]}"
    assert_status 400 "POST /orders draft product returns 400"
fi

if [ -n "$USER_ID" ] && [ -n "$PRODUCT_ID" ]; then
    print_test "Create order with insufficient stock should fail"
    do_request "POST" "/orders" "{\"userId\":$USER_ID,\"shippingAddress\":\"Test Address\",\"items\":[{\"productId\":$PRODUCT_ID,\"quantity\":9999}]}"
    assert_status 400 "POST /orders insufficient stock returns 400"
fi

print_test "List all orders"
do_request "GET" "/orders"
assert_status 200 "GET /orders returns 200"

if [ -n "$USER_ID" ]; then
    print_test "Filter orders by user ID"
    do_request "GET" "/orders?userId=$USER_ID"
    assert_status 200 "GET /orders?userId returns 200"
fi

print_test "Filter orders by status"
do_request "GET" "/orders?status=pending"
assert_status 200 "GET /orders?status=pending returns 200"

if [ -n "$ORDER_ID" ]; then
    print_test "Get order by ID with items"
    do_request "GET" "/orders/$ORDER_ID"
    assert_status 200 "GET /orders/:id returns 200"
    assert_contains '"items"' "Response contains items array"
fi

# ============================================================================
# 5. ORDER STATUS TRANSITIONS
# ============================================================================
print_header "5. ORDER STATUS TRANSITIONS"

if [ -n "$ORDER_ID" ]; then
    print_test "Transition: pending → confirmed"
    do_request "PATCH" "/orders/$ORDER_ID" '{"status":"confirmed"}'
    assert_status 200 "PATCH pending→confirmed returns 200"
    assert_contains '"status":"confirmed"' "Status is confirmed"

    print_test "Transition: confirmed → shipped"
    do_request "PATCH" "/orders/$ORDER_ID" '{"status":"shipped"}'
    assert_status 200 "PATCH confirmed→shipped returns 200"
    assert_contains '"status":"shipped"' "Status is shipped"

    print_test "Transition: shipped → delivered"
    do_request "PATCH" "/orders/$ORDER_ID" '{"status":"delivered"}'
    assert_status 200 "PATCH shipped→delivered returns 200"
    assert_contains '"status":"delivered"' "Status is delivered"

    print_test "Invalid transition: delivered → pending should fail"
    do_request "PATCH" "/orders/$ORDER_ID" '{"status":"pending"}'
    assert_status 400 "PATCH delivered→pending returns 400"
else
    echo -e "${RED}⚠ Skipping status transition tests - no ORDER_ID${NC}"
fi

# Test cancellation and stock restoration
if [ -n "$USER_ID" ] && [ -n "$PRODUCT_ID_2" ]; then
    print_test "Create order for cancellation test"
    do_request "POST" "/orders" "{\"userId\":$USER_ID,\"shippingAddress\":\"Cancel Test, City\",\"items\":[{\"productId\":$PRODUCT_ID_2,\"quantity\":5}]}"
    assert_status 201 "POST /orders for cancel test returns 201"
    ORDER_ID_2=$(extract_id)

    if [ -n "$ORDER_ID_2" ]; then
        # Get stock before cancellation
        do_request "GET" "/products/$PRODUCT_ID_2"
        STOCK_BEFORE=$(extract_field "stock")
        echo -e "  ${BLUE}→ Stock before cancellation: $STOCK_BEFORE${NC}"

        print_test "Cancel order"
        do_request "PATCH" "/orders/$ORDER_ID_2" '{"status":"cancelled"}'
        assert_status 200 "PATCH pending→cancelled returns 200"
        assert_contains '"status":"cancelled"' "Status is cancelled"

        print_test "Verify stock restored after cancellation"
        do_request "GET" "/products/$PRODUCT_ID_2"
        STOCK_AFTER=$(extract_field "stock")
        echo -e "  ${BLUE}→ Stock after cancellation: $STOCK_AFTER${NC}"

        EXPECTED=$((STOCK_BEFORE + 5))
        if [ "$STOCK_AFTER" -eq "$EXPECTED" ] 2>/dev/null; then
            echo -e "  ${GREEN}✓ PASS${NC}: Stock restored ($STOCK_BEFORE + 5 = $STOCK_AFTER)"
            ((TESTS_PASSED++))
        else
            echo -e "  ${RED}✗ FAIL${NC}: Stock not restored correctly"
            echo -e "  ${RED}  Expected: $EXPECTED, Got: $STOCK_AFTER${NC}"
            ((TESTS_FAILED++))
            FAILED_TESTS+=("Stock restoration (expected $EXPECTED, got $STOCK_AFTER)")
        fi
    fi
fi

# ============================================================================
# 6. PAGINATION
# ============================================================================
print_header "6. PAGINATION"

print_test "Pagination with limit=1"
do_request "GET" "/users?limit=1"
assert_status 200 "GET /users?limit=1 returns 200"
assert_contains '"limit":1' "Response has limit 1"

print_test "Pagination with limit and offset"
do_request "GET" "/users?limit=1&offset=1"
assert_status 200 "GET /users?limit=1&offset=1 returns 200"
assert_contains '"offset":1' "Response has offset 1"

# ============================================================================
# 7. DELETE OPERATIONS
# ============================================================================
print_header "7. DELETE OPERATIONS"

if [ -n "$ORDER_ID" ]; then
    print_test "Delete delivered order should fail"
    do_request "DELETE" "/orders/$ORDER_ID"
    assert_status 400 "DELETE delivered order returns 400"
fi

if [ -n "$USER_ID" ] && [ -n "$PRODUCT_ID_2" ]; then
    print_test "Create pending order for deletion test"
    do_request "POST" "/orders" "{\"userId\":$USER_ID,\"shippingAddress\":\"Delete Test\",\"items\":[{\"productId\":$PRODUCT_ID_2,\"quantity\":1}]}"

    if [ "$LAST_STATUS" -eq 201 ]; then
        ORDER_ID_3=$(extract_id)

        print_test "Delete pending order should succeed"
        do_request "DELETE" "/orders/$ORDER_ID_3"
        assert_status 204 "DELETE pending order returns 204"

        print_test "Deleted order should not be found"
        do_request "GET" "/orders/$ORDER_ID_3"
        assert_status 404 "GET deleted order returns 404"
    fi
fi

if [ -n "$PRODUCT_ID_3" ]; then
    print_test "Delete product"
    do_request "DELETE" "/products/$PRODUCT_ID_3"
    assert_status 204 "DELETE /products/:id returns 204"

    print_test "Deleted product should not be found"
    do_request "GET" "/products/$PRODUCT_ID_3"
    assert_status 404 "GET deleted product returns 404"
fi

if [ -n "$USER_ID_2" ]; then
    print_test "Delete user"
    do_request "DELETE" "/users/$USER_ID_2"
    assert_status 204 "DELETE /users/:id returns 204"

    print_test "Deleted user should not be found"
    do_request "GET" "/users/$USER_ID_2"
    assert_status 404 "GET deleted user returns 404"
fi

# ============================================================================
# 8. FINAL HEALTH CHECK
# ============================================================================
print_header "8. FINAL VERIFICATION"

print_test "Final health check"
do_request "GET" "/health"
assert_status 200 "Final health check returns 200"

# ============================================================================
# TEST SUMMARY
# ============================================================================
print_header "TEST SUMMARY"

TOTAL=$((TESTS_PASSED + TESTS_FAILED))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Total:  $TOTAL tests"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}✗ $test${NC}"
    done
    echo ""
    exit 1
else
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    exit 0
fi
